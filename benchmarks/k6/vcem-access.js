import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    vcem_access: {
      executor: "constant-vus",
      vus: Number(__ENV.USERS || 10),
      duration: __ENV.DURATION || "300s",
      gracefulStop: "30s",
    },
  },
};

export default function () {
  const url = __ENV.VCEM_API_URL;
  if (!url) throw new Error("VCEM_API_URL is required");
  const res = http.post(`${url}/access`, JSON.stringify({ fixture: "vcem" }), {
    headers: { "Content-Type": "application/json" },
  });
  check(res, { "2xx": (r) => r.status >= 200 && r.status < 300 });
  sleep(1);
}
