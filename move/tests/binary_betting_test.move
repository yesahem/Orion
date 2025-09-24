#[test_only]
module binary_betting::binary_betting_test {
    use aptos_framework::aptos_coin::{Self, AptosCoin};
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::timestamp;
    use aptos_framework::account;
    use binary_betting::binary_betting::{Self, State};
    use std::signer;

    // Test helper functions
    fun setup_test(aptos_framework: &signer, admin: &signer, treasury: &signer): (address, address, address) {
        let admin_addr = signer::address_of(admin);
        let treasury_addr = signer::address_of(treasury);
        let aptos_addr = signer::address_of(aptos_framework);

        // Initialize timestamp
        timestamp::set_time_has_started_for_testing(aptos_framework);
        timestamp::update_global_time_for_test_secs(1000);

        // Initialize AptosCoin
        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(aptos_framework);
        
        // Create accounts
        account::create_account_for_test(admin_addr);
        account::create_account_for_test(treasury_addr);

        // Initialize binary betting
        binary_betting::init(admin, 200, treasury_addr); // 2% fee

        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);

        (admin_addr, treasury_addr, aptos_addr)
    }

    fun setup_users_with_coins(
        aptos_framework: &signer,
        user1: &signer, 
        user2: &signer, 
        user3: &signer,
        amount_each: u64
    ) {
        let user1_addr = signer::address_of(user1);
        let user2_addr = signer::address_of(user2);
        let user3_addr = signer::address_of(user3);

        account::create_account_for_test(user1_addr);
        account::create_account_for_test(user2_addr);
        account::create_account_for_test(user3_addr);

        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(aptos_framework);
        
        // Mint coins for users
        let coins1 = coin::mint<AptosCoin>(amount_each, &mint_cap);
        let coins2 = coin::mint<AptosCoin>(amount_each, &mint_cap);
        let coins3 = coin::mint<AptosCoin>(amount_each, &mint_cap);

        coin::deposit<AptosCoin>(user1_addr, coins1);
        coin::deposit<AptosCoin>(user2_addr, coins2);
        coin::deposit<AptosCoin>(user3_addr, coins3);

        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);
    }

    #[test(aptos_framework = @0x1, admin = @binary_betting, treasury = @0x123)]
    public fun test_initialization(
        aptos_framework: &signer,
        admin: &signer,
        treasury: &signer,
    ) {
        let (admin_addr, treasury_addr, _) = setup_test(aptos_framework, admin, treasury);
        
        // Test that state was initialized correctly
        let current_round_id = binary_betting::get_current_round_id();
        assert!(current_round_id == 0, 1);
    }

    #[test(aptos_framework = @0x1, admin = @binary_betting, treasury = @0x123, user1 = @0x456, user2 = @0x789)]
    public fun test_up_wins_scenario(
        aptos_framework: &signer,
        admin: &signer,
        treasury: &signer,
        user1: &signer,
        user2: &signer,
    ) {
        let (admin_addr, treasury_addr, _) = setup_test(aptos_framework, admin, treasury);
        setup_users_with_coins(aptos_framework, user1, user2, user1, 10000000000); // 100 APT each

        let user1_addr = signer::address_of(user1);
        let user2_addr = signer::address_of(user2);

        // Start round with price 100.00000000 (8 decimals)
        let start_price = 10000000000;
        binary_betting::start_round(admin, start_price, 300); // 5 minutes

        let round_id = binary_betting::get_current_round_id();
        assert!(round_id == 1, 2);

        // User1 bets UP with 10 APT, User2 bets DOWN with 20 APT
        let bet1_amount = 1000000000; // 10 APT
        let bet2_amount = 2000000000; // 20 APT

        binary_betting::place_bet(user1, true, bet1_amount);  // UP
        binary_betting::place_bet(user2, false, bet2_amount); // DOWN

        // Check round info
        let (round_start_price, round_end_price, expiry_time, settled, up_pool, down_pool) = 
            binary_betting::get_round_info(round_id);
        
        assert!(round_start_price == start_price, 3);
        assert!(round_end_price == 0, 4);
        assert!(!settled, 5);
        assert!(up_pool == bet1_amount, 6);
        assert!(down_pool == bet2_amount, 7);

        // Fast forward time past expiry
        timestamp::update_global_time_for_test_secs(1400);

        // Settle with higher price (UP wins)
        let end_price = 11000000000; // 110.00000000
        binary_betting::settle(admin, round_id, end_price);

        // Check settlement
        let (_, settled_end_price, _, is_settled, final_up_pool, final_down_pool) = 
            binary_betting::get_round_info(round_id);
        
        assert!(settled_end_price == end_price, 8);
        assert!(is_settled, 9);

        // Calculate expected values after fee (2%)
        let total_pool = bet1_amount + bet2_amount; // 30 APT
        let fee_amount = (total_pool * 200) / 10000; // 2% fee = 0.6 APT
        let remaining_pool = total_pool - fee_amount; // 29.4 APT

        // User1 should get all remaining pool (29.4 APT)
        let initial_balance1 = coin::balance<AptosCoin>(user1_addr);
        binary_betting::claim(user1, round_id);
        let final_balance1 = coin::balance<AptosCoin>(user1_addr);
        
        let payout1 = final_balance1 - initial_balance1;
        assert!(payout1 == remaining_pool, 10);

        // User2 should get nothing (lost the bet)
        let initial_balance2 = coin::balance<AptosCoin>(user2_addr);
        // User2 cannot claim (no winning bet)
        // This should fail - we'll test this separately

        // Check treasury received fee
        let treasury_balance = coin::balance<AptosCoin>(treasury_addr);
        assert!(treasury_balance == fee_amount, 11);
    }

    #[test(aptos_framework = @0x1, admin = @binary_betting, treasury = @0x123, user1 = @0x456, user2 = @0x789)]
    public fun test_down_wins_scenario(
        aptos_framework: &signer,
        admin: &signer,
        treasury: &signer,
        user1: &signer,
        user2: &signer,
    ) {
        let (admin_addr, treasury_addr, _) = setup_test(aptos_framework, admin, treasury);
        setup_users_with_coins(aptos_framework, user1, user2, user1, 10000000000);

        let user1_addr = signer::address_of(user1);
        let user2_addr = signer::address_of(user2);

        // Start round
        let start_price = 10000000000; // 100.00000000
        binary_betting::start_round(admin, start_price, 300);

        let round_id = binary_betting::get_current_round_id();

        // User1 bets UP with 15 APT, User2 bets DOWN with 10 APT
        let bet1_amount = 1500000000; // 15 APT
        let bet2_amount = 1000000000; // 10 APT

        binary_betting::place_bet(user1, true, bet1_amount);  // UP
        binary_betting::place_bet(user2, false, bet2_amount); // DOWN

        // Fast forward time
        timestamp::update_global_time_for_test_secs(1400);

        // Settle with lower price (DOWN wins)
        let end_price = 9000000000; // 90.00000000
        binary_betting::settle(admin, round_id, end_price);

        // Calculate expected values
        let total_pool = bet1_amount + bet2_amount; // 25 APT
        let fee_amount = (total_pool * 200) / 10000; // 2% fee = 0.5 APT
        let remaining_pool = total_pool - fee_amount; // 24.5 APT

        // User2 should get all remaining pool
        let initial_balance2 = coin::balance<AptosCoin>(user2_addr);
        binary_betting::claim(user2, round_id);
        let final_balance2 = coin::balance<AptosCoin>(user2_addr);
        
        let payout2 = final_balance2 - initial_balance2;
        assert!(payout2 == remaining_pool, 12);

        // Check treasury received fee
        let treasury_balance = coin::balance<AptosCoin>(treasury_addr);
        assert!(treasury_balance == fee_amount, 13);
    }

    #[test(aptos_framework = @0x1, admin = @binary_betting, treasury = @0x123, user1 = @0x456, user2 = @0x789)]
    public fun test_tie_scenario(
        aptos_framework: &signer,
        admin: &signer,
        treasury: &signer,
        user1: &signer,
        user2: &signer,
    ) {
        let (admin_addr, treasury_addr, _) = setup_test(aptos_framework, admin, treasury);
        setup_users_with_coins(aptos_framework, user1, user2, user1, 10000000000);

        let user1_addr = signer::address_of(user1);
        let user2_addr = signer::address_of(user2);

        // Start round
        let start_price = 10000000000; // 100.00000000
        binary_betting::start_round(admin, start_price, 300);

        let round_id = binary_betting::get_current_round_id();

        // Users bet on different sides
        let bet1_amount = 1000000000; // 10 APT
        let bet2_amount = 2000000000; // 20 APT

        binary_betting::place_bet(user1, true, bet1_amount);  // UP
        binary_betting::place_bet(user2, false, bet2_amount); // DOWN

        // Fast forward time
        timestamp::update_global_time_for_test_secs(1400);

        // Settle with same price (TIE)
        let end_price = 10000000000; // Same as start price
        binary_betting::settle(admin, round_id, end_price);

        // In tie scenario, users get their original bets back (no fee)
        let initial_balance1 = coin::balance<AptosCoin>(user1_addr);
        let initial_balance2 = coin::balance<AptosCoin>(user2_addr);

        binary_betting::claim(user1, round_id);
        binary_betting::claim(user2, round_id);

        let final_balance1 = coin::balance<AptosCoin>(user1_addr);
        let final_balance2 = coin::balance<AptosCoin>(user2_addr);

        // Each user should get back their original bet
        assert!(final_balance1 - initial_balance1 == bet1_amount, 14);
        assert!(final_balance2 - initial_balance2 == bet2_amount, 15);

        // Treasury should receive no fee in tie scenario
        let treasury_balance = coin::balance<AptosCoin>(treasury_addr);
        assert!(treasury_balance == 0, 16);
    }

    #[test(aptos_framework = @0x1, admin = @binary_betting, treasury = @0x123, user1 = @0x456, user2 = @0x789, user3 = @0x999)]
    public fun test_multiple_bettors_proportional_payout(
        aptos_framework: &signer,
        admin: &signer,
        treasury: &signer,
        user1: &signer,
        user2: &signer,
        user3: &signer,
    ) {
        let (admin_addr, treasury_addr, _) = setup_test(aptos_framework, admin, treasury);
        setup_users_with_coins(aptos_framework, user1, user2, user3, 10000000000);

        let user1_addr = signer::address_of(user1);
        let user2_addr = signer::address_of(user2);
        let user3_addr = signer::address_of(user3);

        // Start round
        let start_price = 10000000000;
        binary_betting::start_round(admin, start_price, 300);

        let round_id = binary_betting::get_current_round_id();

        // Multiple users bet UP (winners), one bets DOWN (loser)
        let bet1_amount = 1000000000; // 10 APT - UP
        let bet2_amount = 2000000000; // 20 APT - UP  
        let bet3_amount = 3000000000; // 30 APT - DOWN

        binary_betting::place_bet(user1, true, bet1_amount);   // UP
        binary_betting::place_bet(user2, true, bet2_amount);   // UP
        binary_betting::place_bet(user3, false, bet3_amount);  // DOWN

        // Fast forward and settle with UP winning
        timestamp::update_global_time_for_test_secs(1400);
        let end_price = 11000000000; // UP wins
        binary_betting::settle(admin, round_id, end_price);

        // Calculate expected payouts
        let total_pool = bet1_amount + bet2_amount + bet3_amount; // 60 APT
        let fee_amount = (total_pool * 200) / 10000; // 2% = 1.2 APT
        let remaining_pool = total_pool - fee_amount; // 58.8 APT
        let up_pool = bet1_amount + bet2_amount; // 30 APT

        // User1 should get (10/30) * 58.8 = 19.6 APT
        let expected_payout1 = (bet1_amount * remaining_pool) / up_pool;
        // User2 should get (20/30) * 58.8 = 39.2 APT  
        let expected_payout2 = (bet2_amount * remaining_pool) / up_pool;

        let initial_balance1 = coin::balance<AptosCoin>(user1_addr);
        let initial_balance2 = coin::balance<AptosCoin>(user2_addr);

        binary_betting::claim(user1, round_id);
        binary_betting::claim(user2, round_id);

        let final_balance1 = coin::balance<AptosCoin>(user1_addr);
        let final_balance2 = coin::balance<AptosCoin>(user2_addr);

        let actual_payout1 = final_balance1 - initial_balance1;
        let actual_payout2 = final_balance2 - initial_balance2;

        assert!(actual_payout1 == expected_payout1, 17);
        assert!(actual_payout2 == expected_payout2, 18);

        // Check treasury received correct fee
        let treasury_balance = coin::balance<AptosCoin>(treasury_addr);
        assert!(treasury_balance == fee_amount, 19);
    }

    #[test(aptos_framework = @0x1, admin = @binary_betting, treasury = @0x123, user1 = @0x456)]
    #[expected_failure(abort_code = 7, location = binary_betting::binary_betting)]
    public fun test_claim_no_bet_fails(
        aptos_framework: &signer,
        admin: &signer,
        treasury: &signer,
        user1: &signer,
    ) {
        let (admin_addr, treasury_addr, _) = setup_test(aptos_framework, admin, treasury);
        setup_users_with_coins(aptos_framework, user1, user1, user1, 10000000000);

        // Start and settle a round without user1 betting
        let start_price = 10000000000;
        binary_betting::start_round(admin, start_price, 300);
        let round_id = binary_betting::get_current_round_id();

        timestamp::update_global_time_for_test_secs(1400);
        binary_betting::settle(admin, round_id, 11000000000);

        // This should fail - user1 never placed a bet
        binary_betting::claim(user1, round_id);
    }

    #[test(aptos_framework = @0x1, admin = @binary_betting, treasury = @0x123, user1 = @0x456)]
    #[expected_failure(abort_code = 8, location = binary_betting::binary_betting)]
    public fun test_double_claim_fails(
        aptos_framework: &signer,
        admin: &signer,
        treasury: &signer,
        user1: &signer,
    ) {
        let (admin_addr, treasury_addr, _) = setup_test(aptos_framework, admin, treasury);
        setup_users_with_coins(aptos_framework, user1, user1, user1, 10000000000);

        // Start round and place bet
        let start_price = 10000000000;
        binary_betting::start_round(admin, start_price, 300);
        let round_id = binary_betting::get_current_round_id();

        binary_betting::place_bet(user1, true, 1000000000);

        // Settle with UP winning
        timestamp::update_global_time_for_test_secs(1400);
        binary_betting::settle(admin, round_id, 11000000000);

        // First claim should succeed
        binary_betting::claim(user1, round_id);

        // Second claim should fail
        binary_betting::claim(user1, round_id);
    }
}
