You are working in a web app project in the current directory. Build a staking application on Stellar, with on-chain events and an activity feed, and put it on testnet.

Requirements:

1. A Soroban smart contract whose crate is named `staking`, in this project's contract workspace. Users stake the network's native asset (XLM, through its Stellar Asset Contract) and can withdraw it. It must expose these functions, with these names and argument orders (other functions are allowed):
   - `stake(user: Address, amount: i128)`: requires the user's authorization and transfers `amount` from the user to the contract.
   - `unstake(user: Address, amount: i128)`: requires the user's authorization and transfers `amount` back to the user. It must fail if the user has less than `amount` staked.
   - `staked(user: Address) -> i128`: the amount the user has staked.
   - `total_staked() -> i128`: the amount staked by everyone.
   How the contract learns the token's address is up to you, but it must be ready to use as soon as it is deployed.
2. Every successful `stake` and `unstake` publishes one contract event. Its topics are exactly two values: the symbol `stake` or `unstake`, then the user's address. Its data is the amount alone, as an `i128` (not a map, not a vector).
3. Unit tests for the contract covering at least staking, unstaking, unstaking more than is staked, and the events published by `stake` and `unstake`.
4. Deploy the contract to Stellar testnet. Write its contract ID, and nothing else, to a file named `deployment.txt` at the project root.
5. A page at `/staking` that reads from the deployed contract on testnet and shows, as the plain integers the contract returns:
   - the total staked, in an element with `data-testid="total-staked"`;
   - when the URL has an `address` query parameter (`/staking?address=G...`), that address's staked amount, in an element with `data-testid="staked-amount"`;
   - the contract's most recent `stake` and `unstake` events, newest first (at least the last 10 still available from the testnet RPC), each in its own element with `data-testid="event"` and the attributes `data-type` (`stake` or `unstake`), `data-address` (the user's address) and `data-amount` (the amount as an integer).
6. At the project root, `npm run build` builds the web app for production, and `npm run serve` serves that production build on the port given in the `PORT` environment variable.

Use testnet only, never mainnet. Never put a secret key in a file.

Every requirement above can be verified in this environment, without a wallet or a browser extension: with cargo, the Stellar CLI on testnet, and, for the page, `npm run build`, `npm run serve` and a request to the served page (or a headless browser, if the page renders in the browser). Verify each one yourself.

When you are done, report what you built and how you verified each requirement. End your final message with one line: `RESULT: PASS` if you verified every requirement above, or `RESULT: FAIL: <what is missing>` otherwise.
