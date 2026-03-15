.PHONY: setup dev build docker clean test lint help

DOCKER_IMAGE := widget-base:latest
DOCKER_DIR   := docker/widget-base

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

setup: docker ## Install deps + build Docker image (first-time setup)
	npm install

docker: ## Build the widget runtime Docker image
	docker build -t $(DOCKER_IMAGE) $(DOCKER_DIR)

dev: ## Start the Next.js dev server
	npm run dev

build: ## Production build
	npm run build

start: ## Start production server
	npm run start

test: ## Run tests
	npm test

lint: ## Run linter
	npm run lint

clean: ## Remove build artifacts, Docker container, and volume
	rm -rf .next node_modules data/widgets.db
	-docker rm -f widget-runtime 2>/dev/null
	-docker volume rm widget-runtime-dist 2>/dev/null

all: setup dev ## Full bootstrap: install, build Docker, start dev server
