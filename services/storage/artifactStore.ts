import fs from "fs";
import path from "path";
import { EncryptedArtifact } from "../data-proxy/crypto";

export interface ArtifactStore {
  read(dataHash: string): EncryptedArtifact;
  write(dataHash: string, artifact: EncryptedArtifact): void;
  delete(dataHash: string): void;
}

export class FileArtifactStore implements ArtifactStore {
  constructor(private readonly root: string) {}

  read(dataHash: string): EncryptedArtifact {
    return JSON.parse(fs.readFileSync(path.join(this.root, `${dataHash}.json`), "utf8")) as EncryptedArtifact;
  }

  write(dataHash: string, artifact: EncryptedArtifact) {
    fs.mkdirSync(this.root, { recursive: true });
    fs.writeFileSync(path.join(this.root, `${dataHash}.json`), JSON.stringify(artifact, null, 2));
  }

  delete(dataHash: string) {
    const target = path.join(this.root, `${dataHash}.json`);
    if (fs.existsSync(target)) fs.unlinkSync(target);
  }
}
