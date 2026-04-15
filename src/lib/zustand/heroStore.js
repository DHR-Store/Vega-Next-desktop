import { create } from 'zustand';

const useHeroStore = create((set) => ({
  hero: { title: '', link: '', image: '' },
  setHero: (hero) => set({ hero }),
}));

export default useHeroStore;