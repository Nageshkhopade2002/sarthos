import type { Habit } from '../types'
export const habits: Habit[] = [
  {id:'workout',title:'Workout / Walking',category:'Health',targetMinutes:30},
  {id:'diet',title:'Balanced home meals',category:'Diet'},
  {id:'water',title:'Water intake target',category:'Diet'},
  {id:'skin-am',title:'Morning skin care',category:'Skin Care'},
  {id:'skin-pm',title:'Night skin care',category:'Skin Care'},
  {id:'teeth-am',title:'Brush teeth — morning',category:'Personal Care'},
  {id:'teeth-pm',title:'Brush teeth — night',category:'Personal Care'},
  {id:'hair',title:'Hair care (as needed)',category:'Personal Care'},
  {id:'english',title:'Spoken English practice',category:'Learning',targetMinutes:20},
  {id:'coding',title:'Independent coding practice',category:'Career',targetMinutes:30},
  {id:'mind',title:'Calm mind / journaling',category:'Mindset',targetMinutes:5},
  {id:'self-control',title:'Intentional screen & habit use',category:'Mindset'}
]
export const categories = ['Health','Diet','Skin Care','Personal Care','Learning','Career','Mindset']