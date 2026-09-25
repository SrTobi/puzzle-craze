// Keep navigation compatible with Vite's base path when hosted in a subdirectory.
export const links = {
  home: import.meta.env.BASE_URL,
  arrowSurgery: `${import.meta.env.BASE_URL}games/arrow-surgery/`,
  logicSnake: `${import.meta.env.BASE_URL}games/logic-snake/`,
};
