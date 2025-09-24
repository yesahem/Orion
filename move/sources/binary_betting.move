module binary_betting::binary_betting {
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::event::{Self, EventHandle};
    use aptos_framework::signer;
    use aptos_framework::timestamp;
    use aptos_framework::account;
    use std::error;
    use std::vector;
    use aptos_std::table::{Self, Table};

    // Error codes
    const E_NOT_ADMIN: u64 = 1;
    const E_ROUND_NOT_EXISTS: u64 = 2;
    const E_ROUND_EXPIRED: u64 = 3;
    const E_ROUND_NOT_EXPIRED: u64 = 4;
    const E_ROUND_ALREADY_SETTLED: u64 = 5;
    const E_INVALID_AMOUNT: u64 = 6;
    const E_NO_BET_PLACED: u64 = 7;
    const E_ALREADY_CLAIMED: u64 = 8;
    const E_INVALID_FEE: u64 = 9;

    // Constants
    const MAX_FEE_BPS: u64 = 1000; // 10% max fee
    const MIN_BET_AMOUNT: u64 = 1000000; // 0.01 APT (8 decimals)

    struct State has key {
        admin: address,
        current_round_id: u64,
        rounds: Table<u64, Round>,
        fee_bps: u64, // Fee in basis points (100 = 1%)
        treasury: address,
        bet_placed_events: EventHandle<BetPlacedEvent>,
        round_settled_events: EventHandle<RoundSettledEvent>,
    }

    struct Round has store {
        id: u64,
        start_price: u64, // Price in USD with 8 decimals
        end_price: u64,   // Price in USD with 8 decimals
        expiry_time_secs: u64,
        settled: bool,
        up_pool: Coin<AptosCoin>,
        down_pool: Coin<AptosCoin>,
        up_bets: Table<address, u64>,    // user -> bet amount
        down_bets: Table<address, u64>,  // user -> bet amount
        claims: Table<address, bool>,    // user -> claimed
    }

    struct BetPlacedEvent has drop, store {
        round_id: u64,
        user: address,
        side_up: bool,
        amount: u64,
        timestamp: u64,
    }

    struct RoundSettledEvent has drop, store {
        round_id: u64,
        start_price: u64,
        end_price: u64,
        up_wins: bool,
        is_tie: bool,
        up_pool_amount: u64,
        down_pool_amount: u64,
        fee_amount: u64,
        timestamp: u64,
    }

    // Initialize the betting contract
    public entry fun init(admin: &signer, fee_bps: u64, treasury: address) {
        let admin_addr = signer::address_of(admin);
        assert!(fee_bps <= MAX_FEE_BPS, error::invalid_argument(E_INVALID_FEE));
        
        let state = State {
            admin: admin_addr,
            current_round_id: 0,
            rounds: table::new(),
            fee_bps,
            treasury,
            bet_placed_events: account::new_event_handle<BetPlacedEvent>(admin),
            round_settled_events: account::new_event_handle<RoundSettledEvent>(admin),
        };
        
        move_to(admin, state);
    }

    // Start a new betting round
    public entry fun start_round(admin: &signer, start_price: u64, duration_secs: u64) acquires State {
        let admin_addr = signer::address_of(admin);
        let state = borrow_global_mut<State>(@binary_betting);
        assert!(state.admin == admin_addr, error::permission_denied(E_NOT_ADMIN));

        let round_id = state.current_round_id + 1;
        let expiry_time = timestamp::now_seconds() + duration_secs;

        let round = Round {
            id: round_id,
            start_price,
            end_price: 0,
            expiry_time_secs: expiry_time,
            settled: false,
            up_pool: coin::zero<AptosCoin>(),
            down_pool: coin::zero<AptosCoin>(),
            up_bets: table::new(),
            down_bets: table::new(),
            claims: table::new(),
        };

        table::add(&mut state.rounds, round_id, round);
        state.current_round_id = round_id;
    }

    // Place a bet on the current round
    public entry fun place_bet(user: &signer, side_up: bool, amount: u64) acquires State {
        let user_addr = signer::address_of(user);
        let state = borrow_global_mut<State>(@binary_betting);
        
        assert!(amount >= MIN_BET_AMOUNT, error::invalid_argument(E_INVALID_AMOUNT));
        assert!(state.current_round_id > 0, error::invalid_state(E_ROUND_NOT_EXISTS));

        let round = table::borrow_mut(&mut state.rounds, state.current_round_id);
        let current_time = timestamp::now_seconds();
        assert!(current_time < round.expiry_time_secs, error::invalid_state(E_ROUND_EXPIRED));

        // Transfer coins from user
        let payment = coin::withdraw<AptosCoin>(user, amount);

        if (side_up) {
            // Add to existing bet if user already bet up
            if (table::contains(&round.up_bets, user_addr)) {
                let existing_bet = table::borrow_mut(&mut round.up_bets, user_addr);
                *existing_bet = *existing_bet + amount;
            } else {
                table::add(&mut round.up_bets, user_addr, amount);
            };
            coin::merge(&mut round.up_pool, payment);
        } else {
            // Add to existing bet if user already bet down
            if (table::contains(&round.down_bets, user_addr)) {
                let existing_bet = table::borrow_mut(&mut round.down_bets, user_addr);
                *existing_bet = *existing_bet + amount;
            } else {
                table::add(&mut round.down_bets, user_addr, amount);
            };
            coin::merge(&mut round.down_pool, payment);
        };

        // Emit event
        event::emit_event(&mut state.bet_placed_events, BetPlacedEvent {
            round_id: state.current_round_id,
            user: user_addr,
            side_up,
            amount,
            timestamp: current_time,
        });
    }

    // Settle a round with the end price
    public entry fun settle(admin: &signer, round_id: u64, end_price: u64) acquires State {
        let admin_addr = signer::address_of(admin);
        let state = borrow_global_mut<State>(@binary_betting);
        assert!(state.admin == admin_addr, error::permission_denied(E_NOT_ADMIN));

        assert!(table::contains(&state.rounds, round_id), error::invalid_argument(E_ROUND_NOT_EXISTS));
        let round = table::borrow_mut(&mut state.rounds, round_id);
        
        let current_time = timestamp::now_seconds();
        assert!(current_time >= round.expiry_time_secs, error::invalid_state(E_ROUND_NOT_EXPIRED));
        assert!(!round.settled, error::invalid_state(E_ROUND_ALREADY_SETTLED));

        round.end_price = end_price;
        round.settled = true;

        let up_pool_amount = coin::value(&round.up_pool);
        let down_pool_amount = coin::value(&round.down_pool);
        let total_pool = up_pool_amount + down_pool_amount;

        let is_tie = round.start_price == end_price;
        let up_wins = end_price > round.start_price;

        let fee_amount = 0;
        
        if (!is_tie && total_pool > 0) {
            // Calculate fee
            fee_amount = (total_pool * state.fee_bps) / 10000;
            
            // Extract fee to treasury
            if (fee_amount > 0) {
                let fee_from_up = (fee_amount * up_pool_amount) / total_pool;
                let fee_from_down = fee_amount - fee_from_up;
                
                if (fee_from_up > 0) {
                    let fee_coin_up = coin::extract(&mut round.up_pool, fee_from_up);
                    coin::deposit(state.treasury, fee_coin_up);
                };
                
                if (fee_from_down > 0) {
                    let fee_coin_down = coin::extract(&mut round.down_pool, fee_from_down);
                    coin::deposit(state.treasury, fee_coin_down);
                };
            };
        };

        // Emit settlement event
        event::emit_event(&mut state.round_settled_events, RoundSettledEvent {
            round_id,
            start_price: round.start_price,
            end_price,
            up_wins,
            is_tie,
            up_pool_amount,
            down_pool_amount,
            fee_amount,
            timestamp: current_time,
        });
    }

    // Claim winnings from a settled round
    public entry fun claim(user: &signer, round_id: u64) acquires State {
        let user_addr = signer::address_of(user);
        let state = borrow_global_mut<State>(@binary_betting);
        
        assert!(table::contains(&state.rounds, round_id), error::invalid_argument(E_ROUND_NOT_EXISTS));
        let round = table::borrow_mut(&mut state.rounds, round_id);
        assert!(round.settled, error::invalid_state(E_ROUND_ALREADY_SETTLED));

        // Check if user already claimed
        if (table::contains(&round.claims, user_addr)) {
            assert!(!*table::borrow(&round.claims, user_addr), error::invalid_state(E_ALREADY_CLAIMED));
        } else {
            table::add(&mut round.claims, user_addr, false);
        };

        let up_pool_amount = coin::value(&round.up_pool);
        let down_pool_amount = coin::value(&round.down_pool);
        let is_tie = round.start_price == round.end_price;
        let up_wins = round.end_price > round.start_price;

        let payout = 0;

        if (is_tie) {
            // Refund original bet
            if (table::contains(&round.up_bets, user_addr)) {
                payout = *table::borrow(&round.up_bets, user_addr);
            } else if (table::contains(&round.down_bets, user_addr)) {
                payout = *table::borrow(&round.down_bets, user_addr);
            };
        } else if (up_wins) {
            // UP won - distribute total pool to UP bettors proportionally
            if (table::contains(&round.up_bets, user_addr)) {
                let user_bet = *table::borrow(&round.up_bets, user_addr);
                if (up_pool_amount > 0) {
                    let total_remaining = up_pool_amount + down_pool_amount;
                    payout = (user_bet * total_remaining) / up_pool_amount;
                };
            };
        } else {
            // DOWN won - distribute total pool to DOWN bettors proportionally
            if (table::contains(&round.down_bets, user_addr)) {
                let user_bet = *table::borrow(&round.down_bets, user_addr);
                if (down_pool_amount > 0) {
                    let total_remaining = up_pool_amount + down_pool_amount;
                    payout = (user_bet * total_remaining) / down_pool_amount;
                };
            };
        };

        assert!(payout > 0, error::invalid_state(E_NO_BET_PLACED));

        // Mark as claimed
        let claimed = table::borrow_mut(&mut round.claims, user_addr);
        *claimed = true;

        // Transfer payout
        let payout_coin = if (is_tie) {
            // For ties, pay from the appropriate pool
            if (table::contains(&round.up_bets, user_addr)) {
                coin::extract(&mut round.up_pool, payout)
            } else {
                coin::extract(&mut round.down_pool, payout)
            }
        } else if (up_wins) {
            // Pay from combined pools
            let from_up = if (up_pool_amount >= payout) { payout } else { up_pool_amount };
            let from_down = payout - from_up;
            
            let payout_coin = coin::extract(&mut round.up_pool, from_up);
            if (from_down > 0) {
                let down_coin = coin::extract(&mut round.down_pool, from_down);
                coin::merge(&mut payout_coin, down_coin);
            };
            payout_coin
        } else {
            // Pay from combined pools
            let from_down = if (down_pool_amount >= payout) { payout } else { down_pool_amount };
            let from_up = payout - from_down;
            
            let payout_coin = coin::extract(&mut round.down_pool, from_down);
            if (from_up > 0) {
                let up_coin = coin::extract(&mut round.up_pool, from_up);
                coin::merge(&mut payout_coin, up_coin);
            };
            payout_coin
        };

        coin::deposit(user_addr, payout_coin);
    }

    // View functions
    #[view]
    public fun get_current_round_id(): u64 acquires State {
        let state = borrow_global<State>(@binary_betting);
        state.current_round_id
    }

    #[view]
    public fun get_round_info(round_id: u64): (u64, u64, u64, bool, u64, u64) acquires State {
        let state = borrow_global<State>(@binary_betting);
        assert!(table::contains(&state.rounds, round_id), error::invalid_argument(E_ROUND_NOT_EXISTS));
        
        let round = table::borrow(&state.rounds, round_id);
        (
            round.start_price,
            round.end_price,
            round.expiry_time_secs,
            round.settled,
            coin::value(&round.up_pool),
            coin::value(&round.down_pool)
        )
    }

    #[view]
    public fun get_user_bet(round_id: u64, user: address): (u64, u64) acquires State {
        let state = borrow_global<State>(@binary_betting);
        assert!(table::contains(&state.rounds, round_id), error::invalid_argument(E_ROUND_NOT_EXISTS));
        
        let round = table::borrow(&state.rounds, round_id);
        let up_bet = if (table::contains(&round.up_bets, user)) {
            *table::borrow(&round.up_bets, user)
        } else { 0 };
        
        let down_bet = if (table::contains(&round.down_bets, user)) {
            *table::borrow(&round.down_bets, user)
        } else { 0 };
        
        (up_bet, down_bet)
    }

    #[view]
    public fun has_claimed(round_id: u64, user: address): bool acquires State {
        let state = borrow_global<State>(@binary_betting);
        assert!(table::contains(&state.rounds, round_id), error::invalid_argument(E_ROUND_NOT_EXISTS));
        
        let round = table::borrow(&state.rounds, round_id);
        if (table::contains(&round.claims, user)) {
            *table::borrow(&round.claims, user)
        } else {
            false
        }
    }
}
