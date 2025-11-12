export default defineEventHandler((event) => {
  const cookieOptions = {
    path: "/",
    maxAge: -1,
  } as const;

  setCookie(event, "access_token", "", cookieOptions);
  setCookie(event, "id_token", "", cookieOptions);
  setCookie(event, "refresh_token", "", cookieOptions);

  return {
    success: true,
  };
});
