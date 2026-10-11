export const isAuthorizedCronRequest = (authorization: string | null, secret: string | undefined): boolean => {
  return typeof secret === "string" && secret.length >= 16 && authorization === `Bearer ${secret}`;
};
