$ErrorActionPreference = 'Stop'

# 콘솔 및 외부 프로그램 출력 인코딩을 UTF-8로 맞춥니다.
$utf8 = [System.Text.UTF8Encoding]::new($false)
& "$env:WINDIR\System32\chcp.com" 65001 > $null
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8

Push-Location $PSScriptRoot
try {
    Write-Host 'SubAI 서버 주소: http://127.0.0.1:5188/SubAI/'
    node ./server.mjs
    if ($LASTEXITCODE -ne 0) { throw 'SubAI Node.js 서버 실행에 실패했습니다.' }
}
finally {
    Pop-Location
}