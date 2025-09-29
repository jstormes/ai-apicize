import { ApicizeResponse, BodyType } from '@apicize/lib';
import { RequestConfig } from './types';

export class ApicizeClient {
    constructor(
        private config: any,
        private auth: any
    ) {}

    async execute(request: RequestConfig): Promise<ApicizeResponse> {
        // This is a simplified implementation
        // In a full implementation, this would handle:
        // - Authentication
        // - Base URL resolution
        // - Variable substitution
        // - Request execution via HTTP client

        const response = await fetch(request.url, {
            method: request.method,
            headers: this.buildHeaders(request.headers),
            body: request.body ? JSON.stringify(request.body) : undefined
        });

        const text = await response.text();
        let bodyData: any = text;
        let bodyType = BodyType.Text;

        try {
            bodyData = JSON.parse(text);
            bodyType = BodyType.JSON;
        } catch {
            // Keep as text
        }

        return {
            status: response.status,
            statusText: response.statusText,
            headers: Array.from(response.headers.entries()).map(([name, value]) => ({ name, value })),
            body: {
                type: bodyType,
                data: bodyData
            }
        };
    }

    private buildHeaders(headers: Array<{ name: string; value: string }> = []): Record<string, string> {
        const headerMap: Record<string, string> = {};
        headers.forEach(({ name, value }) => {
            headerMap[name] = value;
        });
        return headerMap;
    }
}
