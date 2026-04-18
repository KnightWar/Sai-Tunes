/**
 * sample.js — Generates a silent sample track for testing.
 * Updated to bypass scoping issues.
 */

const SampleGenerator = (() => {
  const BEEP_WAV = 'UklGRl9vAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YT1vAACAgICAgICAgICAgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK';

  async function getSampleData(session) {
    const id = `t_sample_${Date.now()}`;
    const sampleName = `${session.charAt(0).toUpperCase() + session.slice(1)} Test Track`;
    
    // Save to DB
    await DB.saveTrack({ 
      id, 
      base64: BEEP_WAV, 
      mimeType: 'audio/wav' 
    });

    return {
      id,
      name: sampleName,
      duration: 1.0,
      mimeType: 'audio/wav'
    };
  }

  return { getSampleData };
})();
