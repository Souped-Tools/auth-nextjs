import { NextRequest, NextResponse } from 'next/server';

declare function proxy(request: NextRequest): Promise<NextResponse<unknown>>;
declare const config: {
    matcher: string[];
};

export { config, proxy };
