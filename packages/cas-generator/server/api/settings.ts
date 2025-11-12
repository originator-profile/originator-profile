export default defineEventHandler(async () => {
  return {
    WEBROOT_PATH: process.env.WEBROOT_PATH,
    VC_OUTPUT_PATH: process.env.VC_OUTPUT_PATH,
    CAS_OUTPUT_PATH: process.env.CAS_OUTPUT_PATH,
  };
});
