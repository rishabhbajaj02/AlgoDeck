# Temporary Azure Kubernetes demo

This runs both services on AKS and keeps the existing Supabase database. It is a learning deployment with one fixed node and one replica per service. Access is through an authenticated Kubernetes port forward to localhost; the app has no public ingress. Your browser talks to Supabase Auth over HTTPS and to the forwarded API on localhost. Do not expose this HTTP listener publicly.

The user's maximum budget is $5. AKS Free tier means the control plane is free, not the worker VM, disk, egress/load balancer, registry or image builds. On October 11, 2026 the Azure Retail Prices API returned $0.096/hour for Linux Standard_D2s_v5 in East US: roughly $70.08 for 730 hours of compute alone. A two-hour demo uses about $0.192 of that compute, plus provisioning/cleanup time and other resources. This is an estimate, not a billing cap; check the subscription's current prices, remaining credit and quotas before creating anything. Delete the dedicated group after the demo. Stopping AKS leaves billable disks, registry and networking.

Sources: [AKS pricing](https://azure.microsoft.com/en-us/pricing/details/kubernetes-service/), [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices), [AKS stop/start](https://learn.microsoft.com/en-us/azure/aks/start-stop-cluster).

## Before deployment

1. Agree to a temporary demo and deletion of its dedicated resource group after inspection, with a maximum two-hour window. Do not leave it running as a $5/month deployment.
2. Install Azure CLI from Microsoft and sign in yourself; never paste credentials or tokens into chat. On Windows:

```powershell
winget install --exact --id Microsoft.AzureCLI
```

Open a new terminal after installation:

```powershell
az login
az account set --subscription '<your subscription ID>'
az account show --query '{name:name,id:id,state:state}' --output table
```

3. Confirm permissions to create AKS/ACR and assign the cluster identity's AcrPull role. Owner or equivalent resource and role-assignment permissions are needed. Check regional VM quota/capacity; use the selected affordable SKU rather than silently substituting a larger one.
4. Run `npm run lint`, `npm test`, `npm run test:integration`, `npm run build`, `npm run security` and `kubectl kustomize deploy/kubernetes`.
5. Register localhost:8080/auth as an allowed Supabase Auth redirect URL if email confirmation is needed. The database remains in Supabase; no Azure database is created.

Run the following commands individually. After the first resource is created, record the UTC deadline at two hours from that moment. Any failure, timeout or interruption after creation must go directly to the cleanup section; do not leave resources running while troubleshooting or waiting for help. These are reviewable commands, not an unattended provisioning script. The local Docker daemon is optional because ACR can build the images remotely.

## Create only the agreed demo resources

Use a unique, newly created resource group. Confirm `az group exists` is false before proceeding; never select a group containing unrelated resources. Keep the node resource group name so cleanup can be verified.

```powershell
$taskSuffix = Get-Date -Format 'yyyyMMddHHmm'
$taskGroup = "algodeck-demo-$taskSuffix"
$taskNodeGroup = "$taskGroup-nodes"
$taskRegistry = "algodeck$taskSuffix"
$taskCluster = 'algodeck-demo'
$taskRegion = 'eastus'
az group exists --name $taskGroup
```

After verifying the name and current estimate:

```powershell
az group create --name $taskGroup --location $taskRegion --tags purpose=algodeck-demo
az acr create --resource-group $taskGroup --name $taskRegistry --sku Basic --admin-enabled false
az aks create --resource-group $taskGroup --name $taskCluster --location $taskRegion --node-resource-group $taskNodeGroup --tier free --node-count 1 --node-vm-size Standard_D2s_v5 --node-osdisk-size 64 --enable-managed-identity --attach-acr $taskRegistry --network-plugin azure --network-plugin-mode overlay --no-ssh-key
```

There is no node autoscaler, HPA, managed ingress add-on or paid monitoring workspace in this demo. The standard AKS outbound network resources still cost money.

## Build and configure

Use the URL and public publishable key already configured in the app. These variables are public and intentionally embedded in the frontend. Never substitute a service-role key. Run from the repository root:

```powershell
$taskSupabaseUrl = '<your Supabase project URL>'
$taskPublicKey = '<your Supabase publishable key>'
$taskTag = Get-Date -Format 'yyyyMMddHHmmss'
az acr build --registry $taskRegistry --image "algodeck-api:$taskTag" --file Dockerfile .
az acr build --registry $taskRegistry --image "algodeck-web:$taskTag" --file frontend/Dockerfile --build-arg "VITE_SUPABASE_URL=$taskSupabaseUrl" --build-arg "VITE_SUPABASE_PUBLIC_KEY=$taskPublicKey" .
$taskLoginServer = az acr show --name $taskRegistry --query loginServer --output tsv
```

If the images have already been built and verified locally, reuse them instead of running the two ACR build commands. This demo used the local images with tag `verify`:

```powershell
$taskTag = 'verify'
$taskLoginServer = az acr show --name $taskRegistry --query loginServer --output tsv
az acr login --name $taskRegistry
docker tag algodeck-api:verify "$taskLoginServer/algodeck-api:$taskTag"
docker tag algodeck-web:verify "$taskLoginServer/algodeck-web:$taskTag"
docker push "$taskLoginServer/algodeck-api:$taskTag"
docker push "$taskLoginServer/algodeck-web:$taskTag"
```

Create a local deployment overlay. `.deploy` is ignored by Git and excluded from Docker build contexts. It holds the kubeconfig and rendered settings; do not share its contents.

```powershell
New-Item -ItemType Directory -Path .deploy/overlay -Force | Out-Null
$taskOverlay = @{
    apiVersion = 'kustomize.config.k8s.io/v1beta1'
    kind = 'Kustomization'
    namespace = 'algodeck'
    resources = @('../../deploy/kubernetes')
    images = @(
        @{name='algodeck-api'; newName="$taskLoginServer/algodeck-api"; newTag=$taskTag},
        @{name='algodeck-web'; newName="$taskLoginServer/algodeck-web"; newTag=$taskTag}
    )
    configMapGenerator = @(@{
        name='algodeck-config'
        behavior='merge'
        literals=@("SUPABASE_URL=$taskSupabaseUrl", "SUPABASE_PUBLIC_KEY=$taskPublicKey")
    })
}
# JSON is valid YAML; Kustomize requires this recognized filename.
$taskOverlay | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 .deploy/overlay/kustomization.yaml
kubectl kustomize .deploy/overlay
az aks get-credentials --resource-group $taskGroup --name $taskCluster --file .deploy/kubeconfig
# If the default resolver cannot resolve the new AKS hostname, verify it with
# a trusted DNS resolver and retain hostname verification when using the IP.
# Never use --insecure-skip-tls-verify or change system-wide DNS for this demo.
kubectl --kubeconfig .deploy/kubeconfig get nodes
kubectl --kubeconfig .deploy/kubeconfig apply -k .deploy/overlay
kubectl --kubeconfig .deploy/kubeconfig -n algodeck rollout status deployment/algodeck-api --timeout=180s
kubectl --kubeconfig .deploy/kubeconfig -n algodeck rollout status deployment/algodeck-web --timeout=180s
kubectl --kubeconfig .deploy/kubeconfig -n algodeck get pods,services
```

## Inspect the running app

In one terminal, keep this running while inspecting:

```powershell
kubectl --kubeconfig .deploy/kubeconfig -n algodeck port-forward service/algodeck-web 8080:8080 --address 127.0.0.1
```

In a second terminal:

```powershell
Invoke-RestMethod http://localhost:8080/api/health
Invoke-RestMethod http://localhost:8080/api/ready
```

Open http://localhost:8080 and verify landing, sign-in, SPA refresh, existing collections, question history and practice persistence. Supabase sessions are scoped to the browser origin, so sign in yourself at this new port. Inspect structured API logs with `kubectl --kubeconfig .deploy/kubeconfig -n algodeck logs deployment/algodeck-api --tail=50`; logs are pod stdout, not a persistent logging service. Rate limiting is in memory; port-forward clients share the forwarded source IP.

For failures, inspect `get pods`, `describe pod` and recent events. ImagePullBackOff usually means AcrPull permissions have not propagated. Failed readiness means Supabase settings/schema/egress need checking. A missing redirect allowlist affects confirmation emails. Never fix a failure by turning off authentication or RLS.

## Finish and stop charges

Close the port-forward process. After the agreed inspection, verify the group name contains only this demo, then delete exactly that group:

```powershell
az resource list --resource-group $taskGroup --query '[].{name:name,type:type}' --output table
az group delete --name $taskGroup --yes
az group exists --name $taskGroup
az group exists --name $taskNodeGroup
```

Both existence checks must become false. AKS deletion normally removes its managed node group; investigate any remaining resources rather than assuming cleanup succeeded. Supabase data is separate and is preserved. Check Azure Cost Analysis after billing catches up. Budget alerts are notifications, not automatic spending caps. Do not deploy this plan if deletion cannot be completed within the agreed demo window.

## A public deployment later

A durable public site needs a larger agreed budget, domain/TLS, an ingress strategy, backups and monitoring. AKS's current managed Gateway API is the supported path to evaluate rather than adopting the retiring managed NGINX ingress add-on. This demo's nginx is an application web server, not an ingress controller. See [AKS managed Gateway API](https://learn.microsoft.com/en-us/azure/aks/app-routing-gateway-api).


