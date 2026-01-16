class AtomicFizzRadio {
  constructor(playlistUrl, stationUrl) {
    this.audio = new Audio();
    this.audio.volume = 0.7;
    this.playlist = [];
    this.station = {};
    this.currentTrack = 0;

    Promise.all([
      fetch(playlistUrl).then(r => r.json()),
      fetch(stationUrl).then(r => r.json())
    ]).then(([playlist, station]) => {
      this.playlist = playlist.tracks;
      this.station = station;
      this.playRandom();
    });
  }

  playRandom() {
    this.currentTrack = Math.floor(Math.random() * this.playlist.length);
    const track = this.playlist[this.currentTrack];
    this.audio.src = `/audio/radio/tracks/${track.file}`;
    this.audio.play();

    this.audio.onended = () => this.playRandom();
  }
}

window.AtomicFizzRadio = AtomicFizzRadio;

{
  "station": "Atomic Fizz Radio",
  "description": "Vintage swing, jazz, western, and novelty tunes for the wandering survivor.",
  "tracks": [
    { "file": "just_swing.mp3", "title": "Just Swing", "artist": "Big Band Ensemble" },
    { "file": "satin_shoes_and_brass.mp3", "title": "Satin Shoes and Brass", "artist": "Vintage Orchestra" },
    { "file": "lazy_bones.mp3", "title": "Lazy Bones", "artist": "Billy Munn" },
    { "file": "backseat_bop.mp3", "title": "Backseat Bop", "artist": "Rockabilly Trio" },
    { "file": "poodle_skirt_swirl.mp3", "title": "Poodle Skirt Swirl", "artist": "Retro Dance Band" },
    { "file": "home_on_the_range.mp3", "title": "Home on the Range", "artist": "US Army Band" },
    { "file": "shenandoah.mp3", "title": "Shenandoah", "artist": "US Army Chorus" },
    { "file": "stars_and_stripes.mp3", "title": "Stars and Stripes Forever", "artist": "US Marine Band" },
    { "file": "retro_radio_jingle.mp3", "title": "Retro Radio Jingle", "artist": "Vintage Novelty" }
  ]
}
