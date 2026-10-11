# Azure App Service

The frontend and backend run together on a Linux Free F1 App Service plan in Canada Central, using Node 22 LTS. Express serves the compiled React app and its deep links, with the authenticated API at `/api`. The existing Supabase database remains separate.

The deployed app is `algodeck-202610111929-web` in resource group `algodeck-app-202610111929`:

- Website: https://algodeck-202610111929-web.azurewebsites.net
- Portal: https://portal.azure.com/#resource/subscriptions/56f95344-1fe8-4ac5-9b6b-3bd52a7e2d2d/resourceGroups/algodeck-app-202610111929/providers/Microsoft.Web/sites/algodeck-202610111929-web/configuration

## Supabase settings in the portal

Open the App Service's **Settings → Environment variables → App settings**. Add these two settings, then Apply:

| Setting | Value |
| --- | --- |
| `SUPABASE_URL` | `https://qgujeniaorcunrcstnwj.supabase.co` |
| `SUPABASE_PUBLIC_KEY` | Your existing public publishable key |

The app uses Supabase's REST API with each signed-in user's JWT. It does not read an App Service database connection string or need a PostgreSQL password or service-role key. Startup deliberately fails until the two required settings are valid. The frontend was built with the same project URL and public key supplied earlier; changing projects requires rebuilding it.

For confirmation/password-reset redirects, add `https://algodeck-202610111929-web.azurewebsites.net/auth` to the Supabase Auth redirect allowlist. Existing account password sign-in can be tested without changing this list.

## Deployment and updates

Run from the repository root. Build and verify first:

```powershell
npm run lint
npm test
npm run test:integration
$env:VITE_API_URL = ''
npm run build
npm run security
```

Stage the root package manifests and each workspace's package manifest and compiled `dist` directory in `.deploy/app-service`. Install backend/shared production dependencies there with `npm ci --omit=dev --workspace backend --workspace shared --include-workspace-root`. Archive with symlink dereferencing so the shared workspace becomes ordinary files in `node_modules`. Exclude `.env`, kubeconfig, credentials and test data. Do not bundle native addons built for another OS; this backend has none, and the exact package was verified on Linux. ZIP the staged contents with the package manifest at the archive root. Upload with:

```powershell
az webapp deploy --resource-group algodeck-app-202610111929 --name algodeck-202610111929-web --src-path .deploy/app-service-bundled.zip --type zip
```

The archive root `start` script runs `node backend/dist/backend/src/server.js`; the App Service startup override remains empty so Azure uses that script. `NODE_ENV=production`, `TRUST_PROXY=1` and `FRONTEND_ORIGIN=https://algodeck-202610111929-web.azurewebsites.net` are set. HTTPS is required, FTP is disabled and minimum TLS is 1.2.

The package includes locked production backend/shared dependencies and compiled frontend assets. `SCM_DO_BUILD_DURING_DEPLOYMENT=false` avoids rebuilding or repacking dependencies on the Free service. The archive root package manifest includes a `start` script with the startup command above.

## Verification and cost

After saving settings, `/api/health` should return `ok`, `/api/ready` should return `ready`, and private API endpoints should reject unauthenticated requests. Refresh `/auth` and a nested `/app` route to confirm SPA serving. Sign in yourself on the Azure origin to verify your existing collections and completed practice.

Free F1 is shared development hosting with daily CPU quotas and idle cold starts. Do not upgrade the plan without revisiting the user's $5 budget. No registry, container cluster, paid logging service or Azure database is needed by this deployment.

The earlier AKS demo resource group `algodeck-demo-202610111913` and its managed node group `algodeck-demo-202610111913-nodes` were deleted and both existence checks returned false. Its brief provisioning may still appear in delayed Azure billing. The ContainerRegistry provider stays registered as explicitly approved.

References: [Node.js Free-tier quickstart](https://learn.microsoft.com/en-us/azure/app-service/quickstart-nodejs), [Node.js configuration](https://learn.microsoft.com/en-us/azure/app-service/configure-language-nodejs), [Oryx build settings](https://github.com/microsoft/Oryx/blob/main/doc/configuration.md).


## Verified deployment evidence

On October 11, the self-contained ZIP completed deployment and site startup successfully. HTTPS checks returned health `ok`, Supabase readiness `ready`, frontend `/auth` 200 and unauthenticated collections 401. Browser rendering of the hosted landing and authentication pages succeeded. Initial Free hosting startup failures led to an hourly block; the block cleared at 20:00 UTC. The final deployment uses Node 22 LTS and no remote build. The initial startup cause could not be confirmed because Azure blocked runtime logs.

The failed first app was removed. Only `algodeck-202610111929-web` remains in the dedicated group with the Free F1 plan. The existing Supabase data and user settings were preserved.

The user signed in on the Azure origin. The hosted dashboard loaded the existing demo collection and five completed reviews. Its completed session showed 2 Easy, 1 Medium and 2 Hard ratings; refreshing the deep link restored authentication and the saved summary. Screenshot: [Azure practice verification](screenshots/azure-practice-complete.jpg).
