import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const vcemModule = buildModule("VCEMModule", (m) => {
  const registry = m.contract("VCEMRegistry");
  const consent = m.contract("VCEMConsent", [registry]);
  const audit = m.contract("VCEMAudit", [registry, consent]);

  return { registry, consent, audit };
});

export default vcemModule;
