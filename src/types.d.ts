type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

type SocialLinks = {
  vkLink?: string;
  tgLink?: string;
};
