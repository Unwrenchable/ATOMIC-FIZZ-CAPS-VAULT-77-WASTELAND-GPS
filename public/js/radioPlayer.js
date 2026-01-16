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
