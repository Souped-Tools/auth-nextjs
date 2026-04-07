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

export type { SoupedClaims as S, SoupedConfig as a };
