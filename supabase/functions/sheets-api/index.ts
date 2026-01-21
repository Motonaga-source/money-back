import { google } from "npm:googleapis@140";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain: string;
}

const credentials: ServiceAccountCredentials = {
  type: "service_account",
  project_id: "vihara21",
  private_key_id: "284fb89f88554e75fc88deed80ffac1e1c9734d2",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCJNeIGTS2RPXgs\njbLfwF2x1PmifEygY4fyVeq76NRG30o2ITTTYe8tIUMqVaWT8GBCdoXOwaiQifm/\nA2qeb3sDz50ZEX1Dij0Vfvfw/Jle2Gyr03G+3QlN2b6wC8zaLGXTGVn/sU/l3428\nGMZhR0dhn43jTZee41ZB5KO3Q2tSWXupgnm2HbTJdBtvv0VS+BIiitoY57LWivNL\nsmwczFoTAGfJcBTe6Lq7kbCPAPgubnjChDp60ELRCzPGjCeXWRvJgQInSt2pH/p3\nbJ+mBl5Y6tvaVy4H2139G7A0dITc5IlkmGxuyxMG3gUD1I2QSa6Wa9KLlnTIbL/f\nAWaQOJcbAgMBAAECggEAA5lsFZyRApuEBgMs5eK0HStIOyNwl8/Ulp5QsIo3MKlr\nLHKq4eqn7V1PLOf0lntlQwkR5y5m/2z8e1lvGBCLlQ+CqvrYTYfC+h02YCt4KH1G\nkyv88rP1/6/5E8F+J7D8y3tW7uFWBmKFY3bw6Udcj3/cfHx3auhtcFVmQrNG4vDt\nJf3mglZQ/qo0geOuIkBQ0eOHfpD2ZzRZzge6AVaq1aa7Tc5e4aZYD+EdH7AEGEAm\nwYqGSxSAjQK7Cs9mLqcatWTLxwVnrYiN5imQjT2jMVdSTxbwGcgzq4QXM+O8cgFr\nahIw9EEoSS625VmRay7VPriCKv7mGLAxG1dG9IpcjQKBgQC9cQHA7akeVG1vLSc5\nrLstxlRNqkBvxmy1kskM6v4A0FMn4uof9sigfGtFdTRhUVSZmY0Sy6EJ3KX3S21P\njtZE8oHnh+PuT3QNmoj4lag1tP7N9ZX5kDy6LQolwdZB4x1rSh8F4hJlGvvlm61e\nGlulCGr/xYJM3FkghYpoyOBRDwKBgQC5awzexOhXEv03YIWHFKMIg8VeukfqNrKN\nrfZMABgh3k1PG8HXBcZA+r/rKucnBJM1AJ5uAOqhVpWGTyBiPPvZRbW9mzrzxu+9\nGupYsS/CMaHM9R9vrPVpW7TpVKv2ByzI9BbrCZcRyftG1VvPRwkZlEtLah4FFthc\nu4OawZ1BNQKBgAm60iI8kqESKQS6xvb5Xiu9sfrDMcgL4u14eocFUsJr8LltuCSo\nIinL+h55JJWS/ctdzZcXik/dW1DWOOkLJwongnCH1DcbMZS5SSurVBZeE3A0mt1U\ngSn2wjyqNfzwU0R9bBZ7RAKZXjKuyjq5E9foFMbKOCUGdDVtZmx3VL4VAoGBAJpW\n2We1UBDq5Yvq9Dr0mqDDzs6DEMmMriPw4ktw6KWIfaGT4U4yqEv+bTI7jB2WWVKN\nKVM3wBZ8FAqwYqxjRuAcfqNNS00QEw6+EMOy+aYT2jLY90nmFoGUrIpsyJcKceT0\nCP+sA+vyzQ6xGrL21kRMhEBKHKLv2TmXfHydHWDhAoGBAKt+SB7QZHgaZT4GTRdX\n44cr1iwCodQgGNURY2Mzf/foHJIVJo+Hil2GmC3CF6gSsDBNPBYN2p31y5tgD8vv\nV2f1Nkx8y0Z629Qjq0hcGOSPskhfoAI5jvyxuj6qc+S2Q0bp78Osxq4pvIlUr4K9\nrWQo8MaQpcPxobiXD4JNrgKL\n-----END PRIVATE KEY-----\n",
  client_email: "hiroaki@vihara21.iam.gserviceaccount.com",
  client_id: "116486650023885068678",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/hiroaki%40vihara21.iam.gserviceaccount.com",
  universe_domain: "googleapis.com",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);

    console.log("Initializing Google Auth...");
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    console.log("Creating sheets client...");
    const sheets = google.sheets({ version: "v4", auth });

    if (req.method === "POST") {
      const body = await req.json();
      const { spreadsheetId, sheetName, data } = body;

      console.log(`POST Request: spreadsheetId=${spreadsheetId}, sheetName=${sheetName}, rows=${data?.length}`);

      if (!spreadsheetId || !sheetName || !data) {
        console.error("Missing required parameters for write");
        return new Response(
          JSON.stringify({ error: "spreadsheetId, sheetName, and data are required" }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      console.log(`Clearing existing data in ${sheetName}...`);
      await sheets.spreadsheets.values.clear({
        spreadsheetId: spreadsheetId,
        range: `${sheetName}!A2:Z`,
      });

      console.log(`Writing ${data.length} rows to ${sheetName}...`);
      const response = await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: `${sheetName}!A2`,
        valueInputOption: "RAW",
        requestBody: {
          values: data,
        },
      });

      console.log(`Successfully wrote ${response.data.updatedRows} rows to ${sheetName}`);

      return new Response(
        JSON.stringify({
          success: true,
          updatedRows: response.data.updatedRows,
          updatedColumns: response.data.updatedColumns,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const spreadsheetId = url.searchParams.get("spreadsheetId");
    const sheetName = url.searchParams.get("sheetName");
    const range = url.searchParams.get("range") || "A:Z";

    console.log(`GET Request: spreadsheetId=${spreadsheetId}, sheetName=${sheetName}, range=${range}`);

    if (!spreadsheetId || !sheetName) {
      console.error("Missing required parameters");
      return new Response(
        JSON.stringify({ error: "spreadsheetId and sheetName are required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const fullRange = `${sheetName}!${range}`;
    console.log(`Fetching data from range: ${fullRange}`);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: fullRange,
    });

    const rows = response.data.values || [];
    console.log(`Successfully fetched ${rows.length} rows from ${sheetName}`);

    return new Response(JSON.stringify({ data: rows }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error processing spreadsheet request:", error);

    let errorMessage = "Failed to fetch data";
    let statusCode = 500;

    if (error.message) {
      errorMessage = error.message;

      if (error.message.includes("Unable to parse range")) {
        errorMessage = `シート名「${url.searchParams.get("sheetName")}」が見つかりません。スプレッドシート内のシート名を確認してください。`;
        statusCode = 404;
      } else if (error.message.includes("permission") || error.message.includes("403")) {
        errorMessage = "スプレッドシートへのアクセス権限がありません。サービスアカウント(hiroaki@vihara21.iam.gserviceaccount.com)に共有してください。";
        statusCode = 403;
      } else if (error.message.includes("not found") || error.message.includes("404")) {
        errorMessage = "スプレッドシートが見つかりません。IDを確認してください。";
        statusCode = 404;
      }
    }

    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: error.message,
        sheetName: url.searchParams.get("sheetName"),
      }),
      {
        status: statusCode,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
