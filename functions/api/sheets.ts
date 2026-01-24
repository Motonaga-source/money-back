// Cloudflare Pages Function for Google Sheets API
// This handles both GET (read) and POST (write) requests to Google Sheets

interface Env {
    GOOGLE_SERVICE_ACCOUNT_EMAIL: string;
    GOOGLE_PRIVATE_KEY: string;
    SPREADSHEET_ID: string;
}

interface SheetReadRequest {
    sheetName: string;
    range: string;
}

interface SheetWriteRequest {
    sheetName: string;
    data: any[][];
}

// Helper function to create JWT for Google API authentication
async function createJWT(
    serviceAccountEmail: string,
    privateKey: string
): Promise<string> {
    const header = {
        alg: 'RS256',
        typ: 'JWT',
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: serviceAccountEmail,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
    };

    const encodedHeader = btoa(JSON.stringify(header))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    const encodedPayload = btoa(JSON.stringify(payload))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

    const unsignedToken = `${encodedHeader}.${encodedPayload}`;

    // Import the private key with improved error handling
    try {
        const pemHeader = '-----BEGIN PRIVATE KEY-----';
        const pemFooter = '-----END PRIVATE KEY-----';

        // Debug: Log the first 100 characters of the private key
        console.log('🔑 Private key (first 100 chars):', privateKey.substring(0, 100));

        // Handle both literal newlines and escaped newlines (\n)
        let cleanedKey = privateKey;

        // Remove quotes if present
        if (cleanedKey.startsWith('"') && cleanedKey.endsWith('"')) {
            cleanedKey = cleanedKey.slice(1, -1);
        }
        if (cleanedKey.startsWith("'") && cleanedKey.endsWith("'")) {
            cleanedKey = cleanedKey.slice(1, -1);
        }

        // Replace escaped newlines with actual newlines
        cleanedKey = cleanedKey.replace(/\\n/g, '\n');

        // Extract the PEM contents (between header and footer)
        const pemContents = cleanedKey
            .replace(pemHeader, '')
            .replace(pemFooter, '')
            .replace(/\n/g, '')  // Remove actual newlines
            .replace(/\r/g, '')  // Remove carriage returns
            .replace(/\s/g, ''); // Remove all whitespace

        console.log('🔑 PEM contents length:', pemContents.length);
        console.log('🔑 PEM contents (first 50 chars):', pemContents.substring(0, 50));

        // Validate base64 content
        if (!/^[A-Za-z0-9+/=]+$/.test(pemContents)) {
            throw new Error('Invalid base64 characters in private key');
        }

        const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

        console.log('🔑 Binary DER length:', binaryDer.length);

        const cryptoKey = await crypto.subtle.importKey(
            'pkcs8',
            binaryDer,
            {
                name: 'RSASSA-PKCS1-v1_5',
                hash: 'SHA-256',
            },
            false,
            ['sign']
        );

        // Sign the token
        const signature = await crypto.subtle.sign(
            'RSASSA-PKCS1-v1_5',
            cryptoKey,
            new TextEncoder().encode(unsignedToken)
        );

        const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');

        return `${unsignedToken}.${encodedSignature}`;
    } catch (error) {
        console.error('❌ Failed to process private key:', error);
        console.error('Private key format issue. Make sure the key includes BEGIN/END markers and uses \\n for newlines.');
        throw new Error(`Private key processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// Get access token from Google
async function getAccessToken(
    serviceAccountEmail: string,
    privateKey: string
): Promise<string> {
    const jwt = await createJWT(serviceAccountEmail, privateKey);

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('Failed to get access token:', error);
        throw new Error(`Failed to authenticate with Google: ${error}`);
    }

    const data = await response.json();
    return data.access_token;
}

// Read data from Google Sheets
async function readSheet(
    accessToken: string,
    spreadsheetId: string,
    sheetName: string,
    range: string
): Promise<any[][]> {
    const fullRange = `${sheetName}!${range}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        fullRange
    )}`;

    console.log(`📖 Reading from: ${fullRange}`);

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('Failed to read sheet:', error);
        throw new Error(`Failed to read sheet: ${error}`);
    }

    const data = await response.json();
    console.log(`✅ Read ${data.values?.length || 0} rows from ${sheetName}`);
    return data.values || [];
}

// Write data to Google Sheets
async function writeSheet(
    accessToken: string,
    spreadsheetId: string,
    sheetName: string,
    data: any[][]
): Promise<{ updatedRows: number }> {
    console.log(`📝 Writing ${data.length} rows to ${sheetName}...`);

    // First, clear existing data
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        `${sheetName}!A2:Z`
    )}:clear`;

    const clearResponse = await fetch(clearUrl, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    });

    if (!clearResponse.ok) {
        const error = await clearResponse.text();
        console.error('Failed to clear sheet:', error);
        throw new Error(`Failed to clear sheet: ${error}`);
    }

    // Then, write new data
    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        `${sheetName}!A2`
    )}?valueInputOption=RAW`;

    const writeResponse = await fetch(writeUrl, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            values: data,
        }),
    });

    if (!writeResponse.ok) {
        const error = await writeResponse.text();
        console.error('Failed to write sheet:', error);
        throw new Error(`Failed to write sheet: ${error}`);
    }

    const result = await writeResponse.json();
    console.log(`✅ Successfully wrote ${result.updatedRows} rows to ${sheetName}`);

    return {
        updatedRows: result.updatedRows || 0,
    };
}

// Main handler
export async function onRequest(context: {
    request: Request;
    env: Env;
}): Promise<Response> {
    const { request, env } = context;

    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: corsHeaders,
        });
    }

    try {
        console.log(`🔵 ${request.method} request to /api/sheets`);

        // Validate environment variables
        if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
            throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL is not set');
        }
        if (!env.GOOGLE_PRIVATE_KEY) {
            throw new Error('GOOGLE_PRIVATE_KEY is not set');
        }
        if (!env.SPREADSHEET_ID) {
            throw new Error('SPREADSHEET_ID is not set');
        }

        console.log(`📧 Service Account: ${env.GOOGLE_SERVICE_ACCOUNT_EMAIL}`);
        console.log(`📊 Spreadsheet ID: ${env.SPREADSHEET_ID}`);

        // Get access token
        const accessToken = await getAccessToken(
            env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            env.GOOGLE_PRIVATE_KEY
        );

        if (request.method === 'GET') {
            // Read request
            const url = new URL(request.url);
            const sheetName = url.searchParams.get('sheetName');
            const range = url.searchParams.get('range') || 'A:Z';

            if (!sheetName) {
                return new Response(
                    JSON.stringify({
                        error: 'sheetName parameter is required',
                    }),
                    {
                        status: 400,
                        headers: {
                            ...corsHeaders,
                            'Content-Type': 'application/json',
                        },
                    }
                );
            }

            const data = await readSheet(
                accessToken,
                env.SPREADSHEET_ID,
                sheetName,
                range
            );

            return new Response(
                JSON.stringify({
                    data,
                }),
                {
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json',
                    },
                }
            );
        } else if (request.method === 'POST') {
            // Write request
            const body: SheetWriteRequest = await request.json();

            if (!body.sheetName || !body.data) {
                return new Response(
                    JSON.stringify({
                        error: 'sheetName and data are required',
                    }),
                    {
                        status: 400,
                        headers: {
                            ...corsHeaders,
                            'Content-Type': 'application/json',
                        },
                    }
                );
            }

            const result = await writeSheet(
                accessToken,
                env.SPREADSHEET_ID,
                body.sheetName,
                body.data
            );

            return new Response(
                JSON.stringify({
                    success: true,
                    updatedRows: result.updatedRows,
                }),
                {
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json',
                    },
                }
            );
        } else {
            return new Response(
                JSON.stringify({
                    error: 'Method not allowed',
                }),
                {
                    status: 405,
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json',
                    },
                }
            );
        }
    } catch (error) {
        console.error('❌ Error:', error);

        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown error',
                details: error instanceof Error ? error.stack : undefined,
            }),
            {
                status: 500,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json',
                },
            }
        );
    }
}
