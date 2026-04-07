interface SoupedConfig {
    clientId: string;
    clientSecret: string;
    soupedUrl: string;
}
interface SoupedClaims {
    sub: string;
    email: string;
    roles: string[];
    org: string;
    project: string;
    aud: string | string[];
    iat: number;
    exp: number;
}

declare function getSession(): Promise<SoupedClaims | null>;

export { type SoupedClaims, type SoupedConfig, getSession };
