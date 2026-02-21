export interface WalletConfig {
    walletAddress: string;
    network: 'mainnet-beta' | 'devnet' | 'testnet';
    createdAt: number;
    version: string;
}
export interface WalletStore {
    privateKey: number[];
    address: string;
    network: string;
}
export interface FuegoConfig {
    configPath: string;
    walletPath: string;
    logsPath: string;
}
//# sourceMappingURL=types.d.ts.map