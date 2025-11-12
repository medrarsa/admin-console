$ErrorActionPreference = "Stop"

function Ensure-Dir([string]$Path) {
  if ([string]::IsNullOrWhiteSpace($Path)) { return }
  [void][System.IO.Directory]::CreateDirectory($Path)
}

function Write-TextFile([string]$Path, [string]$Content) {
  $dir = [System.IO.Path]::GetDirectoryName($Path)
  if ($dir -and $dir -ne "") { Ensure-Dir $dir }
  [System.IO.File]::WriteAllText($Path, $Content, [System.Text.Encoding]::UTF8)
}

function Write-EmptyTsx([string]$Path) {
  Write-TextFile $Path 'export default function Page(){ return <div /> }'
}

function Write-EmptyApi([string]$Path) {
  Write-TextFile $Path 'export async function GET(){ return new Response(null,{status:200}); }'
}

# ---- roots ----
$app   = "app"
$api   = "app/api/admin"
$admin = "app/admin"

# app root
Ensure-Dir $app
Write-EmptyTsx ([System.IO.Path]::Combine($app, "layout.tsx"))
Write-EmptyTsx ([System.IO.Path]::Combine($app, "page.tsx"))

# admin root
Ensure-Dir $admin
Write-EmptyTsx ([System.IO.Path]::Combine($admin, "layout.tsx"))
Write-EmptyTsx ([System.IO.Path]::Combine($admin, "page.tsx"))

# products
Ensure-Dir ([System.IO.Path]::Combine($admin, "products"))
Write-EmptyTsx ([System.IO.Path]::Combine($admin, "products/page.tsx"))
Ensure-Dir ([System.IO.Path]::Combine($admin, "products/new"))
Write-EmptyTsx ([System.IO.Path]::Combine($admin, "products/new/page.tsx"))

$prodTabs = @("details","images","variants","prices","inventory","seo","activity")
foreach($t in $prodTabs){
  $tabDir = [System.IO.Path]::Combine($admin, "products/[productId]/$t")
  Ensure-Dir $tabDir
  Write-EmptyTsx ([System.IO.Path]::Combine($tabDir, "page.tsx"))
}
Write-EmptyTsx ([System.IO.Path]::Combine($admin, "products/[productId]/layout.tsx"))

# catalog (3 levels)
Ensure-Dir ([System.IO.Path]::Combine($admin, "catalog/categories"))
Write-EmptyTsx ([System.IO.Path]::Combine($admin, "catalog/categories/page.tsx"))
Ensure-Dir ([System.IO.Path]::Combine($admin, "catalog/categories/new"))
Write-EmptyTsx ([System.IO.Path]::Combine($admin, "catalog/categories/new/page.tsx"))
Ensure-Dir ([System.IO.Path]::Combine($admin, "catalog/categories/[categoryId]"))
Write-EmptyTsx ([System.IO.Path]::Combine($admin, "catalog/categories/[categoryId]/page.tsx"))
Ensure-Dir ([System.IO.Path]::Combine($admin, "catalog/subcategories/[subcategoryId]"))
Write-EmptyTsx ([System.IO.Path]::Combine($admin, "catalog/subcategories/[subcategoryId]/page.tsx"))
Ensure-Dir ([System.IO.Path]::Combine($admin, "catalog/segments/[segmentId]"))
Write-EmptyTsx ([System.IO.Path]::Combine($admin, "catalog/segments/[segmentId]/page.tsx"))

# other admin pages
$others = @(
  "variants/page.tsx",
  "pricing/variant-prices/page.tsx",
  "inventory/variant/page.tsx",
  "inventory/transactions/page.tsx",
  "seo/pages/page.tsx",
  "orders/page.tsx",
  "payments/page.tsx",
  "reports/page.tsx"
)
foreach($p in $others){
  $full = [System.IO.Path]::Combine($admin, $p)
  $dir  = [System.IO.Path]::GetDirectoryName($full)
  if($dir -and $dir -ne ""){ Ensure-Dir $dir }
  Write-EmptyTsx $full
}

# API routes (empty route.ts)
$apiFiles = @(
  "products/route.ts",
  "products/[productId]/route.ts",
  "products/[productId]/images/route.ts",
  "product-images/[imageId]/route.ts",
  "products/[productId]/variants/route.ts",
  "variants/[variantId]/route.ts",
  "variants/[variantId]/prices/route.ts",
  "variant-prices/[priceId]/route.ts",
  "variants/[variantId]/inventory/route.ts",
  "variants/[variantId]/inventory/transactions/route.ts",
  "audit/route.ts",
  "seo/pages/route.ts",
  "seo/pages/[seoId]/route.ts"
)
foreach($f in $apiFiles){
  $full = [System.IO.Path]::Combine($api, $f)
  Write-EmptyApi $full
}

Write-Host "Scaffold created successfully."
