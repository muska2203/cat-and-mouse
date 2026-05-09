Add-Type -AssemblyName System.Drawing

$baseDir = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $baseDir "src/assets/sprites/actors"

$ids = @(
  "witcher",
  "halfling-mage",
  "paladin",
  "elven-ranger",
  "orc-barbarian",
  "samurai",
  "necromancer"
)

$cols = @(
  "#6b8cae",
  "#c9a6dc",
  "#e8d078",
  "#7abe8f",
  "#d08060",
  "#e89898",
  "#889888"
)

for ($i = 0; $i -lt $ids.Length; $i++) {
  $id = $ids[$i]
  $bmp = New-Object System.Drawing.Bitmap 64, 64
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
  $c = [System.Drawing.ColorTranslator]::FromHtml($cols[$i])
  $g.Clear($c)
  $font = New-Object System.Drawing.Font "Arial", 9, ([System.Drawing.FontStyle]::Bold)
  $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(24, 28, 38))
  $abbr = ($id.ToUpper() -replace "-", "").Substring(0, [Math]::Min(3, ($id -replace "-", "").Length))
  $sz = $g.MeasureString($abbr, $font)
  $tx = [single]((64 - $sz.Width) / 2)
  $ty = [single]((64 - $sz.Height) / 2)
  $g.DrawString($abbr, $font, $brush, $tx, $ty)
  $g.Dispose()
  $path = Join-Path $dir ("player_" + $id + ".png")
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "Wrote $path"
}
