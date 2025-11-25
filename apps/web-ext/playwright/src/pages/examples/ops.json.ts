import sp from "../../../public/.well-known/sp.json" assert { type: "json" };

export async function GET(): Promise<Response> {
  return Response.json(sp.originators);
}
