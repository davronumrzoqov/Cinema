/**
 * Boshlang'ich kino katalogi — 50 ta haqiqiy film/serial.
 * poster  — TMDB rasm; trailer — YouTube video ID (rasmiy treyler, tekshirilgan).
 * Server birinchi ishga tushganda db.json shu ro'yxat bilan to'ldiriladi.
 */

const IMG = 'https://image.tmdb.org/t/p/w500';

const movies = [
  // ---- Trend ----
  { id: 1,  name: 'Inception',                          genre: 'Movie',     year: 2010, limit: 'PG-13', poster: `${IMG}/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg`, trailer: 'YoHD9XEInc0', price: 0,    trending: true,  top: true,  popular: false },
  { id: 2,  name: 'Dune',                               genre: 'Movie',     year: 2021, limit: 'PG-13', poster: `${IMG}/d5NXSklXo0qyIYkgV94XAgMIckC.jpg`, trailer: 'n9xhJrPXop4', price: 4.99, trending: true,  top: false, popular: true  },
  { id: 3,  name: 'Breaking Bad',                       genre: 'TV Series', year: 2008, limit: '18+',   poster: `${IMG}/ggFHVNu6YYI5L9pCfOacjizRGt.jpg`,  trailer: 'HhesaQXLuRY', price: 0,    trending: true,  top: false, popular: true  },
  { id: 4,  name: 'Oppenheimer',                        genre: 'Movie',     year: 2023, limit: 'PG-13', poster: `${IMG}/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg`, trailer: 'uYPbbksJxIg', price: 6.99, trending: true,  top: true,  popular: true  },
  { id: 5,  name: 'The Dark Knight',                    genre: 'Movie',     year: 2008, limit: 'PG-13', poster: `${IMG}/qJ2tW6WMUDux911r6m7haRef0WH.jpg`, trailer: 'EXeTwQWrcwY', price: 0,    trending: true,  top: true,  popular: false },
  { id: 41, name: 'Solo Leveling',                      genre: 'TV Series', year: 2024, limit: 'PG-13', poster: `${IMG}/geCRueV3ElhRTr0xtJuEWJt6dJ1.jpg`, trailer: 'YvGSK8mIlt8', price: 3.99, trending: true,  top: false, popular: true  },
  { id: 43, name: 'Demon Slayer: Kimetsu no Yaiba',     genre: 'TV Series', year: 2019, limit: 'PG-13', poster: `${IMG}/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg`, trailer: 'VQGCKyvzIM4', price: 4.99, trending: true,  top: false, popular: true  },

  // ---- Top reyting ----
  { id: 12, name: 'The Shawshank Redemption',           genre: 'Movie',     year: 1994, limit: 'PG-13', poster: `${IMG}/zgyRWri2luavFepRC2vHwYQcT0t.jpg`, trailer: '6hB3S9bIaco', price: 0,    trending: false, top: true,  popular: false },
  { id: 13, name: 'The Godfather',                      genre: 'Movie',     year: 1972, limit: '18+',   poster: `${IMG}/3bhkrj58Vtu7enYsRolD1fZdja1.jpg`, trailer: 'sY1S34973zA', price: 5.99, trending: false, top: true,  popular: false },
  { id: 14, name: 'The Godfather Part II',              genre: 'Movie',     year: 1974, limit: '18+',   poster: `${IMG}/hek3koDUyRQk7FIhPXsa6mT2Zc3.jpg`, trailer: '9O1Iy9od7-A', price: 5.99, trending: false, top: true,  popular: false },
  { id: 15, name: "Schindler's List",                   genre: 'Movie',     year: 1993, limit: '18+',   poster: `${IMG}/sF1U4EUQS8YHUYjNl3pMGNIQyr0.jpg`, trailer: 'gG22XNhtnoY', price: 4.99, trending: false, top: true,  popular: false },
  { id: 16, name: '12 Angry Men',                       genre: 'Movie',     year: 1957, limit: 'PG',    poster: `${IMG}/zhG3vKWyDRaZYoaww1UVAi29T9h.jpg`, trailer: '_13J_9B5jEk', price: 0,    trending: false, top: true,  popular: false },
  { id: 18, name: 'Pulp Fiction',                       genre: 'Movie',     year: 1994, limit: '18+',   poster: `${IMG}/vQWk5YBFWF4bZaofAbv0tShwBvQ.jpg`, trailer: 's7EdQ4FqbhY', price: 4.99, trending: false, top: true,  popular: true  },
  { id: 19, name: 'The Good, the Bad and the Ugly',     genre: 'Movie',     year: 1966, limit: 'PG-13', poster: `${IMG}/bX2xnavhMYjWDoZp1VM6VnU1xwe.jpg`, trailer: 'WCN5JJY_wiA', price: 3.99, trending: false, top: true,  popular: false },
  { id: 20, name: 'Forrest Gump',                       genre: 'Movie',     year: 1994, limit: 'PG-13', poster: `${IMG}/Cw4hIUIAmSYfK9QfaUW5igp9La.jpg`,  trailer: 'bLvqoHBptjg', price: 0,    trending: false, top: true,  popular: true  },
  { id: 21, name: 'GoodFellas',                         genre: 'Movie',     year: 1990, limit: '18+',   poster: `${IMG}/9OkCLM73MIU2CrKZbqiT8Ln1wY2.jpg`, trailer: '2ilzidi_J8Q', price: 4.99, trending: false, top: true,  popular: false },
  { id: 22, name: 'Seven Samurai',                      genre: 'Movie',     year: 1954, limit: 'PG',    poster: `${IMG}/lOMGc8bnSwQhS4XyE1S99uH8NXf.jpg`, trailer: 'wJ1TOratCTo', price: 0,    trending: false, top: true,  popular: false },
  { id: 23, name: 'Grave of the Fireflies',             genre: 'Movie',     year: 1988, limit: 'PG-13', poster: `${IMG}/k9tv1rXZbOhH7eiCk378x61kNQ1.jpg`, trailer: '4vPeTSRd580', price: 0,    trending: false, top: true,  popular: false },
  { id: 24, name: 'Life Is Beautiful',                  genre: 'Movie',     year: 1997, limit: 'PG-13', poster: `${IMG}/74hLDKjD5aGYOotO6esUVaeISa2.jpg`, trailer: '8CTjcVr9Iao', price: 3.99, trending: false, top: true,  popular: false },
  { id: 25, name: 'Fight Club',                         genre: 'Movie',     year: 1999, limit: '18+',   poster: `${IMG}/jSziioSwPVrOy9Yow3XhWIBDjq1.jpg`, trailer: 'qtRKdVHc-cE', price: 4.99, trending: false, top: true,  popular: true  },
  { id: 26, name: 'The Lord of the Rings: The Fellowship of the Ring', genre: 'Movie', year: 2001, limit: 'PG-13', poster: `${IMG}/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg`, trailer: 'V75dMMIW2B4', price: 5.99, trending: false, top: true, popular: true },
  { id: 27, name: 'Cinema Paradiso',                    genre: 'Movie',     year: 1988, limit: 'PG',    poster: `${IMG}/gCI2AeMV4IHSewhJkzsur5MEp6R.jpg`, trailer: 'C2-GX0Tltgw', price: 0,    trending: false, top: true,  popular: false },
  { id: 28, name: 'City of God',                        genre: 'Movie',     year: 2002, limit: '18+',   poster: `${IMG}/k7eYdWvhYQyRQoU2TB2A2Xu2TfD.jpg`, trailer: 'dcUOO4Itgmw', price: 3.99, trending: false, top: true,  popular: false },
  { id: 29, name: 'The Lord of the Rings: The Two Towers', genre: 'Movie',  year: 2002, limit: 'PG-13', poster: `${IMG}/5VTN0pR8gcqV3EPUHHfMGnJYN9L.jpg`, trailer: 'LbfMDwc4azU', price: 5.99, trending: false, top: true,  popular: true  },
  { id: 30, name: 'Psycho',                             genre: 'Movie',     year: 1960, limit: 'PG-13', poster: `${IMG}/yz4QVqPx3h1hD1DfqqQkCq3rmxW.jpg`, trailer: 'Wz719b9QUqY', price: 0,    trending: false, top: true,  popular: false },
  { id: 31, name: "One Flew Over the Cuckoo's Nest",    genre: 'Movie',     year: 1975, limit: '18+',   poster: `${IMG}/kjWsMh72V6d8KRLV4EOoSJLT1H7.jpg`, trailer: 'OXrcDonY-B8', price: 3.99, trending: false, top: true,  popular: false },
  { id: 32, name: 'The Empire Strikes Back',            genre: 'Movie',     year: 1980, limit: 'PG',    poster: `${IMG}/nNAeTmF4CtdSgMDplXTDPOpYzsX.jpg`, trailer: 'JNwNXF9Y6kY', price: 5.99, trending: false, top: true,  popular: true  },
  { id: 33, name: "Howl's Moving Castle",               genre: 'Movie',     year: 2004, limit: 'PG',    poster: `${IMG}/13kOl2v0nD2OLbVSHnHk8GUFEhO.jpg`, trailer: 'iwROgK94zcM', price: 0,    trending: false, top: true,  popular: true  },
  { id: 34, name: 'Se7en',                              genre: 'Movie',     year: 1995, limit: '18+',   poster: `${IMG}/191nKfP0ehp3uIvWqgPbFmI4lv9.jpg`, trailer: 'znmZoVkCjpI', price: 4.99, trending: false, top: true,  popular: true  },
  { id: 35, name: 'Once Upon a Time in America',        genre: 'Movie',     year: 1984, limit: '18+',   poster: `${IMG}/i0enkzsL5dPeneWnjl1fCWm6L7k.jpg`, trailer: 'LcpCRyNo8T8', price: 4.99, trending: false, top: true,  popular: false },
  { id: 36, name: 'Whiplash',                           genre: 'Movie',     year: 2014, limit: 'PG-13', poster: `${IMG}/7fn624j5lj3xTme2SgiLCeuedmO.jpg`, trailer: '7d_jQycdQGo', price: 0,    trending: false, top: true,  popular: false },
  { id: 37, name: 'The Pianist',                        genre: 'Movie',     year: 2002, limit: '18+',   poster: `${IMG}/2hFvxCCWrTmCYwfy7yum0GKRi3Y.jpg`, trailer: 'BFwGqLa_oAo', price: 3.99, trending: false, top: true,  popular: false },
  { id: 38, name: 'High and Low',                       genre: 'Movie',     year: 1963, limit: 'PG-13', poster: `${IMG}/tgNjemQPG96uIezpiUiXFcer5ga.jpg`, trailer: 'ELsgPvgDBoY', price: 0,    trending: false, top: true,  popular: false },
  { id: 39, name: 'The Silence of the Lambs',           genre: 'Movie',     year: 1991, limit: '18+',   poster: `${IMG}/uS9m8OBk1A8eM9I042bx8XXpqAq.jpg`, trailer: 'W6Mm8Sbe__o', price: 4.99, trending: false, top: true,  popular: true  },
  { id: 40, name: 'The Sopranos',                       genre: 'TV Series', year: 1999, limit: '18+',   poster: `${IMG}/rTc7ZXdroqjkKivFPvCPX0Ru7uw.jpg`, trailer: 'Q8cBFvpqmH0', price: 0,    trending: false, top: true,  popular: true  },
  { id: 47, name: 'Cosmos: A Personal Voyage',          genre: 'TV Series', year: 1980, limit: 'G',     poster: `${IMG}/nOGArjE0WMkzY2GW1taJm8l9gxD.jpg`, trailer: 'bSxHZPoQ4JQ', price: 0,    trending: false, top: true,  popular: false },
  { id: 7,  name: 'Interstellar',                       genre: 'Movie',     year: 2014, limit: 'PG-13', poster: `${IMG}/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg`, trailer: 'zSWdZVtXT7E', price: 3.99, trending: false, top: true,  popular: true  },
  { id: 9,  name: 'Parasite',                           genre: 'Movie',     year: 2019, limit: '18+',   poster: `${IMG}/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg`, trailer: '5xH0HfJHsaY', price: 0,    trending: false, top: true,  popular: false },

  // ---- Mashhur ----
  { id: 6,  name: 'Stranger Things',                    genre: 'TV Series', year: 2016, limit: 'PG-13', poster: `${IMG}/49WJfeN0moxb9IPfGn8AIqMGskD.jpg`, trailer: 'b9EkMc79ZSU', price: 0,    trending: false, top: false, popular: true },
  { id: 8,  name: 'The Mandalorian',                    genre: 'TV Series', year: 2019, limit: 'PG',    poster: `${IMG}/eU1i6eHXlzMOlEq0ku1Rzq7Y4wA.jpg`, trailer: 'aOC8E8z_ifw', price: 4.99, trending: false, top: false, popular: true },
  { id: 10, name: 'The Witcher',                        genre: 'TV Series', year: 2019, limit: '18+',   poster: `${IMG}/7vjaCdMw15FEbXyLQTVa04URsPm.jpg`, trailer: 'ndl1W4ltcmg', price: 3.99, trending: false, top: false, popular: true },
  { id: 11, name: 'Spider-Man: Into the Spider-Verse',  genre: 'Movie',     year: 2018, limit: 'PG',    poster: `${IMG}/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg`, trailer: 'g4Hbz2jLxvQ', price: 0,    trending: false, top: false, popular: true },
  { id: 17, name: 'Avatar: The Last Airbender',         genre: 'TV Series', year: 2024, limit: 'PG',    poster: `${IMG}/9RQhVb3r3mCMqYVhLoCu4EvuipP.jpg`, trailer: 'ByAn8DF8Ykk', price: 4.99, trending: false, top: false, popular: true },
  { id: 42, name: 'Hunter x Hunter',                    genre: 'TV Series', year: 2011, limit: 'PG-13', poster: `${IMG}/i2EEr2uBvRlAwJ8d8zTG2Y19mIa.jpg`, trailer: 'd6kBeJjTGnY', price: 0,    trending: false, top: false, popular: true },
  { id: 44, name: 'Invincible',                         genre: 'TV Series', year: 2021, limit: '18+',   poster: `${IMG}/4tblBrslcKSifMVZ3TmtT2ukMor.jpg`, trailer: '-bfAVpuko5o', price: 4.99, trending: false, top: false, popular: true },
  { id: 45, name: 'Planet Earth II',                    genre: 'TV Series', year: 2016, limit: 'G',     poster: `${IMG}/5maYKYzWpE68ycxGh1luu4P2LOS.jpg`, trailer: 'c8aFcHFu8QM', price: 0,    trending: false, top: false, popular: true },
  { id: 46, name: 'Anne with an E',                     genre: 'TV Series', year: 2017, limit: 'PG',    poster: `${IMG}/6P6tXhjT5tK3qOXzxF9OMLlG7iz.jpg`, trailer: 'qMlQz57mbc8', price: 0,    trending: false, top: false, popular: true },
  { id: 48, name: 'Blue Planet II',                     genre: 'TV Series', year: 2017, limit: 'G',     poster: `${IMG}/j1NsoYYDYHnPkRr7Enqr8tlexgO.jpg`, trailer: 'kAphgHhlteM', price: 0,    trending: false, top: false, popular: true },
  { id: 49, name: 'Slam Dunk',                          genre: 'TV Series', year: 1993, limit: 'PG',    poster: `${IMG}/nmmOKeydeeO4TKucpvyMA2o6gdD.jpg`, trailer: 'A75PkXcSNQ4', price: 0,    trending: false, top: false, popular: true },
  { id: 50, name: 'Regular Show',                       genre: 'TV Series', year: 2010, limit: 'PG',    poster: `${IMG}/mS5SLxMYcKfUxA0utBSR5MOAWWr.jpg`, trailer: 'Mm-Zc1_I1_8', price: 0,    trending: false, top: false, popular: true }
];

module.exports = { movies };
