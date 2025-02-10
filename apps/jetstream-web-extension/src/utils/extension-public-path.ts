// @ts-expect-error need to set this for webpack to work
__webpack_public_path__ = (globalThis.browser || globalThis.chrome)?.runtime?.getURL('') || '/';
