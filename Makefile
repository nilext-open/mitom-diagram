WEB_DIR    := src/client/web
DAEMON_DIR := src/daemon
BIN        := bin/mitom-daemon
VERSION    ?= $(shell date +%Y.%m.%d)

.PHONY: dev build build-web build-daemon run test clean

## dev: Vite dev server with hot reload; builds and starts the daemon automatically
dev: $(WEB_DIR)/node_modules
	cd $(WEB_DIR) && npm run dev

## build: production web bundle + daemon binary
build: build-web build-daemon

build-web: $(WEB_DIR)/node_modules
	cd $(WEB_DIR) && npm run build

build-daemon:
	cd $(DAEMON_DIR) && go build -ldflags "-X main.version=$(VERSION)" -o ../../$(BIN) .

## run: daemon serving the built web client on http://127.0.0.1:7420
run: build
	./$(BIN) -web $(WEB_DIR)/dist

test: $(WEB_DIR)/node_modules
	cd $(DAEMON_DIR) && go vet ./... && go test ./...
	cd $(WEB_DIR) && npm run typecheck && npm test

$(WEB_DIR)/node_modules: $(WEB_DIR)/package.json
	cd $(WEB_DIR) && npm install
	@touch $@

clean:
	rm -rf bin $(DAEMON_DIR)/bin $(WEB_DIR)/dist
