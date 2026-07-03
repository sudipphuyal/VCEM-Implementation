import { ethers } from "ethers";

export const RESEARCHER_ROLE = 3;

export class RegistryIdentityResolver {
  private readonly contract: ethers.Contract;

  constructor(registryAddress: string, provider: ethers.Provider, abi: any[]) {
    this.contract = new ethers.Contract(registryAddress, abi, provider);
  }

  async resolveActiveResearcher(wallet: string) {
    const normalized = ethers.getAddress(wallet);
    const actorId = await this.contract.idOfWallet(normalized);
    if (actorId === ethers.ZeroHash) throw new Error("wallet is not registered");
    const active = await this.contract.isActiveActor(actorId, RESEARCHER_ROLE);
    if (!active) throw new Error("requestor is inactive, revoked, or not a researcher");
    const registeredWallet = await this.contract.walletOf(actorId);
    if (ethers.getAddress(registeredWallet) !== normalized) throw new Error("registered wallet mismatch");
    return actorId as string;
  }
}
