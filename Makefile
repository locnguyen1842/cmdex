.PHONY: dev build generate check clean

dev:
	wails dev

build:
	wails build

generate:
	wails generate module

check:
	go build ./...
	cd frontend && pnpm tsc --noEmit

clean:
	rm -rf build/bin frontend/dist
