SERVICE_ID := 4xcJEpXWuWl4SffL0eAYIo
# Build/serve/publish need Node >= 20.19; pin to 22 via nvm.
NODE := . $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null &&

.PHONY: help build serve deploy activate versions backends logs reinstall

help: ## List targets
	@grep -hE '^[a-z-]+:.*##' $(MAKEFILE_LIST) | sed 's/:.*##/\t/' | sort

build: ## Compile src -> bin/main.wasm
	$(NODE) npm run build

serve: ## Run locally on http://127.0.0.1:7676
	$(NODE) fastly compute serve

deploy: ## Build + publish a new version to Fastly
	$(NODE) fastly compute publish --service-id $(SERVICE_ID)

activate: ## Activate a version: make activate VERSION=8
	@test -n "$(VERSION)" || { echo "usage: make activate VERSION=<n>"; exit 1; }
	fastly service-version activate --service-id $(SERVICE_ID) --version $(VERSION)

versions: ## List service versions
	fastly service-version list --service-id $(SERVICE_ID)

backends: ## List backends on the active version
	fastly backend list --service-id $(SERVICE_ID) --version active

logs: ## Tail live production logs (console.log)
	fastly log-tail --service-id $(SERVICE_ID)

reinstall: ## Clean npm reinstall (fixes missing native bindings)
	rm -rf node_modules package-lock.json && $(NODE) npm install
