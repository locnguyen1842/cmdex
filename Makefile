.PHONY: dev build generate check clean

dev:
	wails3 dev

build:
	wails3 build

generate:
	wails3 generate bindings

check:
	go build ./...
	cd frontend && pnpm tsc --noEmit

clean:
	rm -rf build/bin frontend/dist
