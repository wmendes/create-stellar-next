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
4. A page at `/staking` that reads from the deployed contract on testnet and shows, as the plain integers the contract returns:
   - the total staked, in an element with `data-testid="total-staked"`;
   - when the URL has an `address` query parameter (`/staking?address=G...`), that address's staked amount, in an element with `data-testid="staked-amount"`.
5. The project's own checks must pass when you finish.

Use testnet only, never mainnet. Never put a secret key in a file.

Every requirement above can be verified in this environment, without a browser or a wallet: with cargo, the Stellar CLI on testnet, the project's own scripts, and, for the page, a production server (`next start`) and an HTTP request. Verify each one yourself.

When you are done, report what you built and how you verified each requirement. End your final message with one line: `RESULT: PASS` if you verified every requirement above, or `RESULT: FAIL: <what is missing>` otherwise.
