import sp from "../../../public/.well-known/sp.json" with { type: "json" };

export async function GET(): Promise<Response> {
  return Response.json(sp.originators);
}
