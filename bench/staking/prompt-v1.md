You are working in a Next.js project in the current directory. Build a simple staking application on Stellar and put it on testnet.

Requirements:

1. A Soroban smart contract whose crate is named `staking`, in this project's contract workspace. Users stake the network's native asset (XLM, through its Stellar Asset Contract) and can withdraw it. It must expose these functions, with these names and argument orders (other functions are allowed):
   - `stake(user: Address, amount: i128)`: requires the user's authorization and transfers `amount` from the user to the contract.
   - `unstake(user: Address, amount: i128)`: requires the user's authorization and transfers `amount` back to the user. It must fail if the user has less than `amount` staked.
   - `staked(user: Address) -> i128`: the amount the user has staked.
   - `total_staked() -> i128`: the amount staked by everyone.
   How the contract learns the token's address is up to you, but it must be ready to use as soon as it is deployed.
2. Unit tests for the contract covering at least staking, unstaking, and unstaking more than is staked.
3. Deploy the contract to Stellar testnet. Write its contract ID, and nothing else, to a file named `deployment.txt` at the project root.
4. A page at `/staking` that shows the total staked, read from the deployed contract on testnet, as the plain integer the contract returns, in an element with `data-testid="total-staked"`. The page also needs a button to connect a wallet (`data-testid="connect-wallet"`) and a form to stake an amount with the connected wallet: an input (`data-testid="stake-amount"`) and a submit button (`data-testid="stake-submit"`).
5. The project's own checks must pass when you finish.

Use testnet only, never mainnet. Never put a secret key in a file.

When you are done, report what you built and how you verified it. End your final message with one line: `RESULT: PASS` if you verified that everything above works, or `RESULT: FAIL: <what is missing>` otherwise.
