'use strict';

const { discoverAgents } = require('../../map-agents');

const PROVIDERS = Object.freeze([
  Object.freeze({ id: 'codex', name: 'Codex', load: () => require('./codex') }),
  Object.freeze({ id: 'claude', name: 'Claude Code', load: () => require('./claude') }),
]);

const CAPABILITIES = Object.freeze({
  scopedProjectTools: true,
  reportedActivity: true,
  modelSelection: true,
  effortSelection: true,
  modelCatalog: false,
  authenticationCheck: false,
  quotaCheck: false,
});

function providerFor(vendor) {
  const provider = PROVIDERS.find((candidate) => candidate.id === vendor);
  if (!provider) throw new TypeError('Choose a supported provider: codex or claude.');
  return provider;
}

// Discovery checks local executable paths only. A found CLI does not establish
// a valid login, available allowance, or a model catalog.
async function listProviders(options = {}) {
  const discovered = discoverAgents(options);
  return PROVIDERS.map((provider) => {
    const available = discovered.find((candidate) => candidate.vendor === provider.id)?.available === true;
    return {
      id: provider.id,
      name: provider.name,
      available,
      detail: available
        ? 'CLI installed. Starts a dedicated project session on assignment. Login, quota and model availability are unchecked.'
        : `Install ${provider.name} and sign in on this machine, then refresh. Login, quota and models are not checked.`,
      capabilities: { ...CAPABILITIES },
    };
  });
}

function createLaunch(vendor, options) {
  // Keep the explicit choice intact; each adapter validates its own CLI values.
  return providerFor(vendor).load().createLaunch(options);
}

function parseLine(vendor, line) {
  return providerFor(vendor).load().parseLine(line);
}

module.exports = { listProviders, createLaunch, parseLine };
