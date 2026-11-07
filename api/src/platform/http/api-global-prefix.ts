/**
 * The single source of truth for the HTTP API prefix.
 *
 * The runtime bootstrap and the committed OpenAPI document both read this
 * constant, so a prefix change cannot silently drift the contract.
 */
export const API_GLOBAL_PREFIX = 'v1';
