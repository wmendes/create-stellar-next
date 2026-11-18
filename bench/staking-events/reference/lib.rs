#![no_std]
use soroban_sdk::{contract, contractevent, contractimpl, contracttype, token, Address, Env};

/// Published by `stake`: topics `["stake", user]`, data `amount`.
#[contractevent(data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Stake {
    #[topic]
    pub user: Address,
    pub amount: i128,
}

/// Published by `unstake`: topics `["unstake", user]`, data `amount`.
#[contractevent(data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Unstake {
    #[topic]
    pub user: Address,
    pub amount: i128,
}

#[contracttype]
enum DataKey {
    Token,
    Total,
    Staked(Address),
}

#[contract]
pub struct Staking;

#[contractimpl]
impl Staking {
    pub fn __constructor(env: Env, token: Address) {
        env.storage().instance().set(&DataKey::Token, &token);
    }

    pub fn stake(env: Env, user: Address, amount: i128) {
        user.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        token::Client::new(&env, &token).transfer(&user, &env.current_contract_address(), &amount);
        let key = DataKey::Staked(user.clone());
        let current: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(current + amount));
        let total: i128 = env.storage().instance().get(&DataKey::Total).unwrap_or(0);
        env.storage().instance().set(&DataKey::Total, &(total + amount));
        Stake { user, amount }.publish(&env);
    }

    pub fn unstake(env: Env, user: Address, amount: i128) {
        user.require_auth();
        let key = DataKey::Staked(user.clone());
        let current: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if amount <= 0 || amount > current {
            panic!("insufficient stake");
        }
        env.storage().persistent().set(&key, &(current - amount));
        let total: i128 = env.storage().instance().get(&DataKey::Total).unwrap_or(0);
        env.storage().instance().set(&DataKey::Total, &(total - amount));
        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        token::Client::new(&env, &token).transfer(&env.current_contract_address(), &user, &amount);
        Unstake { user, amount }.publish(&env);
    }

    pub fn staked(env: Env, user: Address) -> i128 {
        env.storage().persistent().get(&DataKey::Staked(user)).unwrap_or(0)
    }

    pub fn total_staked(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Total).unwrap_or(0)
    }
}

mod test;
