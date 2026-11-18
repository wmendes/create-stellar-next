import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions, ExternalExecutableRef } from '@stellar/stellar-sdk/contract';
export interface Client {
    hello(args: {
        to: string;
    }, options?: MethodOptions): Promise<AssembledTransaction<Array<string>>>;
}
export declare class Client extends ContractClient {
    readonly options: ContractClientOptions;
    constructor(options: ContractClientOptions);
    static deploy<T = Client>(options: MethodOptions & Omit<ContractClientOptions, 'contractId'> & {
        salt?: Uint8Array;
        address?: string;
    } & ({
        wasmHash: Uint8Array | string;
        format?: "hex" | "base64";
        externalRef?: never;
    } | {
        externalRef: ExternalExecutableRef;
        wasmHash?: never;
        format?: never;
    })): Promise<AssembledTransaction<T>>;
    readonly fromJson: {
        hello: (json: string) => AssembledTransaction<string[]>;
    };
    /** @deprecated Use fromJson instead. */
    readonly fromJSON: {
        hello: (json: string) => AssembledTransaction<string[]>;
    };
}
