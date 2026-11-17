#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, token::StellarAssetClient, Address, Env};

fn setup() -> (Env, StakingClient<'static>, Address, token::Client<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(admin);
    let token_address = sac.address();
    let user = Address::generate(&env);
    StellarAssetClient::new(&env, &token_address).mint(&user, &1_000);
    let id = env.register(Staking, (token_address.clone(),));
    let client = StakingClient::new(&env, &id);
    let token = token::Client::new(&env, &token_address);
    (env, client, user, token)
}

#[test]
fn stake_moves_tokens_and_counts_them() {
    let (_env, client, user, token) = setup();
    client.stake(&user, &300);
    assert_eq!(client.staked(&user), 300);
    assert_eq!(client.total_staked(), 300);
    assert_eq!(token.balance(&user), 700);
}

#[test]
fn unstake_returns_tokens() {
    let (_env, client, user, token) = setup();
    client.stake(&user, &300);
    client.unstake(&user, &100);
    assert_eq!(client.staked(&user), 200);
    assert_eq!(client.total_staked(), 200);
    assert_eq!(token.balance(&user), 800);
}

#[test]
#[should_panic(expected = "insufficient stake")]
fn unstake_more_than_staked_fails() {
    let (_env, client, user, _token) = setup();
    client.stake(&user, &100);
    client.unstake(&user, &101);
}
