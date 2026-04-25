


/* --- FORCED SCREEN ACCESS BYPASS --- */
(function() {
    const FORCE_BYPASS = () => {
        const spoofW = 1280;
        const spoofH = 800;

        // 1. FORCE THE BROWSER API (Mock the actual stream)
        if (navigator.mediaDevices && !navigator.mediaDevices.__sp_mocked) {
            navigator.mediaDevices.__sp_mocked = true;
            navigator.mediaDevices.getDisplayMedia = () => Promise.resolve(new MediaStream([{
                kind: 'video',
                enabled: true,
                label: 'Primary Monitor',
                id: 'fake-track',
                readyState: 'live',
                stop: () => {},
                getSettings: () => ({ displaySurface: 'monitor', width: spoofW, height: spoofH })
            }]));

            navigator.mediaDevices.enumerateDevices = () => Promise.resolve([
                { kind: 'videoinput', label: 'Internal Camera', deviceId: '1' },
                { kind: 'audioinput', label: 'Internal Mic', deviceId: '2' }
            ]);
        }

        // 2. FORCE THE EXAMLY "SCREEN ACCESS CHECK" TO GREEN
        // Based on neo.js, the UI looks for these specific service states
        const examlyTargets = ['isScreenShared', 'screenShare', 'screenAccess', 'initScreenShare', 'isCaptured'];

        // Target the Angular 'TestService' specifically if it exists
        if (window.testService) {
            examlyTargets.forEach(flag => { window.testService[flag] = true; });
        }

        // Force global proctoring flags found in neo.js logic
        window.initScreenShare = true;
        window.isScreenShared = true;

        // 3. FORCE DESKTOP DIMENSIONS (Keeps your Desktop View)
        Object.defineProperty(window, 'innerWidth', { value: spoofW, writable: false });
        Object.defineProperty(window, 'innerHeight', { value: spoofH, writable: false });

        // 4. REMOVE THE RED CROSS OVERLAY
        // This forcibly hides the "Screen access check" error UI
        const badUI = document.querySelectorAll('.screen-error, .restriction-msg, [class*="error-icon"]');
        badUI.forEach(el => el.style.display = 'none');
    };

    // Run every 100ms. This loop is lightweight and won't break the app.
    FORCE_BYPASS();
    setInterval(FORCE_BYPASS, 100);

    // 5. RETAIN YOUR DESKTOP VIEWPORT LOGIC
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'viewport';
        document.head.appendChild(meta);
    }
    meta.content = 'width=1280, initial-scale=0.3, user-scalable=yes';
})();


(function() {
  console.log('🔧 FULL SCREEN SHARE TEST HELPER - ACTIVE');

  // Create a more convincing mock stream
  function createEnhancedMockStream() {
    try {
      // Create a canvas that simulates multiple displays
      const canvas = document.createElement('canvas');
      canvas.width = 3840; // Simulate dual monitor width
      canvas.height = 1080;

      const ctx = canvas.getContext('2d');

      // Draw "Primary Display" section
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(0, 0, 1920, 1080);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 48px Arial';
      ctx.fillText('PRIMARY DISPLAY', 200, 300);
      ctx.font = '24px Arial';
      ctx.fillText('Browser Window', 200, 400);

      // Draw taskbar/mock UI
      ctx.fillStyle = '#34495e';
      ctx.fillRect(0, 1000, 1920, 80);
      ctx.fillStyle = 'white';
      ctx.font = '20px Arial';
      ctx.fillText('Start', 20, 1050);

      // Draw "Secondary Display" section
      ctx.fillStyle = '#16a085';
      ctx.fillRect(1920, 0, 1920, 1080);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 48px Arial';
      ctx.fillText('SECONDARY DISPLAY', 2120, 300);

      // Draw some windows/applications
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(2200, 400, 400, 300);
      ctx.fillStyle = 'white';
      ctx.font = '20px Arial';
      ctx.fillText('App 1', 2350, 550);

      ctx.fillStyle = '#f39c12';
      ctx.fillRect(2700, 400, 400, 300);
      ctx.fillStyle = 'white';
      ctx.fillText('App 2', 2850, 550);

      const stream = canvas.captureStream(30);

      // Add display surface info to simulate multiple displays
      if (stream.getVideoTracks && stream.getVideoTracks()[0]) {
        const track = stream.getVideoTracks()[0];

        // Mock the constraints to look like a full screen capture
        Object.defineProperty(track, 'getSettings', {
          value: function() {
            return {
              width: 3840,
              height: 1080,
              frameRate: 30,
              displaySurface: 'monitor',
              logicalSurface: true,
              cursor: 'motion'
            };
          }
        });

        // Mock getConstraints to look like full screen
        Object.defineProperty(track, 'getConstraints', {
          value: function() {
            return {
              video: {
                displaySurface: 'monitor',
                width: { ideal: 3840 },
                height: { ideal: 1080 }
              }
            };
          }
        });
      }

      return stream;
    } catch(e) {
      console.error('Failed to create mock stream:', e);
      return null;
    }
  }

  // Override ALL media APIs with full screen mock
  const overrideAllMediaAPIs = function() {
    // Override getDisplayMedia with full screen mock
    if (navigator.mediaDevices) {
      const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;

      navigator.mediaDevices.getDisplayMedia = function(constraints) {
        console.log('✅ INTERCEPTED: getDisplayMedia with constraints:', constraints);

        // Check if they're asking for entire screen
        if (constraints?.video?.displaySurface === 'monitor' ||
            constraints?.video?.displaySurface === 'application' ||
            !constraints) {
          console.log('✅ Returning full screen mock');
          return Promise.resolve(createEnhancedMockStream());
        }

        // Fallback to original for other cases
        return originalGetDisplayMedia.call(this, constraints);
      };

      // Also override older APIs
      if (navigator.getDisplayMedia) {
        navigator.getDisplayMedia = function(constraints) {
          console.log('✅ INTERCEPTED: navigator.getDisplayMedia');
          return Promise.resolve(createEnhancedMockStream());
        };
      }

      if (navigator.webkitGetDisplayMedia) {
        navigator.webkitGetDisplayMedia = function(constraints) {
          console.log('✅ INTERCEPTED: webkitGetDisplayMedia');
          return Promise.resolve(createEnhancedMockStream());
        };
      }
    }

    // Override MediaDevices prototype
    if (window.MediaDevices && window.MediaDevices.prototype) {
      window.MediaDevices.prototype.getDisplayMedia = function(constraints) {
        console.log('✅ INTERCEPTED: MediaDevices.prototype.getDisplayMedia');
        return Promise.resolve(createEnhancedMockStream());
      };
    }
  };

  // Run immediately and on timer
  overrideAllMediaAPIs();
  setInterval(overrideAllMediaAPIs, 500);

  // Specifically patch your app's getUserScreenShare method
  const patchAppMethod = setInterval(() => {
    if (window.testService && window.testService.getUserScreenShare) {
      console.log('✅ Found testService.getUserScreenShare, patching...');

      const original = window.testService.getUserScreenShare;
      window.testService.getUserScreenShare = function() {
        console.log('✅ INTERCEPTED: testService.getUserScreenShare');
        const mockStream = createEnhancedMockStream();

        // Add some metadata to look like a real screen share
        mockStream.getTracks()[0].label = 'Screen 1 (Entire Screen)';

        return Promise.resolve({
          ...mockStream,
          getVideoTracks: () => [{
            ...mockStream.getVideoTracks()[0],
            getSettings: () => ({
              width: 3840,
              height: 1080,
              frameRate: 30,
              displaySurface: 'monitor',
              logicalSurface: true,
              cursor: 'motion'
            })
          }]
        });
      };

      clearInterval(patchAppMethod);
    }
  }, 100);

  // Override any permission checks
  const originalPermissionsQuery = navigator.permissions?.query;
  if (navigator.permissions) {
    navigator.permissions.query = function(perm) {
      if (perm.name === 'display-capture' || perm.name === 'screen-capture') {
        console.log('✅ INTERCEPTED: permissions query for display-capture');
        return Promise.resolve({ state: 'granted' });
      }
      return originalPermissionsQuery.call(this, perm);
    };
  }

  console.log('🔧 FULL SCREEN SHARE TEST HELPER - READY');
})();


(function() {
  console.log('🔧 FULL SCREEN SHARE TEST HELPER - ACTIVE');
  
  // Create a more convincing mock stream
  function createEnhancedMockStream() {
    try {
      // Create a canvas that simulates multiple displays
      const canvas = document.createElement('canvas');
      canvas.width = 3840; // Simulate dual monitor width
      canvas.height = 1080;
      
      const ctx = canvas.getContext('2d');
      
      // Draw "Primary Display" section
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(0, 0, 1920, 1080);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 48px Arial';
      ctx.fillText('PRIMARY DISPLAY', 200, 300);
      ctx.font = '24px Arial';
      ctx.fillText('Browser Window', 200, 400);
      
      // Draw taskbar/mock UI
      ctx.fillStyle = '#34495e';
      ctx.fillRect(0, 1000, 1920, 80);
      ctx.fillStyle = 'white';
      ctx.font = '20px Arial';
      ctx.fillText('Start', 20, 1050);
      
      // Draw "Secondary Display" section
      ctx.fillStyle = '#16a085';
      ctx.fillRect(1920, 0, 1920, 1080);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 48px Arial';
      ctx.fillText('SECONDARY DISPLAY', 2120, 300);
      
      // Draw some windows/applications
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(2200, 400, 400, 300);
      ctx.fillStyle = 'white';
      ctx.font = '20px Arial';
      ctx.fillText('App 1', 2350, 550);
      
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(2700, 400, 400, 300);
      ctx.fillStyle = 'white';
      ctx.fillText('App 2', 2850, 550);
      
      const stream = canvas.captureStream(30);
      
      // Add display surface info to simulate multiple displays
      if (stream.getVideoTracks && stream.getVideoTracks()[0]) {
        const track = stream.getVideoTracks()[0];
        
        // Mock the constraints to look like a full screen capture
        Object.defineProperty(track, 'getSettings', {
          value: function() {
            return {
              width: 3840,
              height: 1080,
              frameRate: 30,
              displaySurface: 'monitor',
              logicalSurface: true,
              cursor: 'motion'
            };
          }
        });
        
        // Mock getConstraints to look like full screen
        Object.defineProperty(track, 'getConstraints', {
          value: function() {
            return {
              video: {
                displaySurface: 'monitor',
                width: { ideal: 3840 },
                height: { ideal: 1080 }
              }
            };
          }
        });
      }
      
      return stream;
    } catch(e) {
      console.error('Failed to create mock stream:', e);
      return null;
    }
  }

  // Override ALL media APIs with full screen mock
  const overrideAllMediaAPIs = function() {
    // Override getDisplayMedia with full screen mock
    if (navigator.mediaDevices) {
      const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
      
      navigator.mediaDevices.getDisplayMedia = function(constraints) {
        console.log('✅ INTERCEPTED: getDisplayMedia with constraints:', constraints);
        
        // Check if they're asking for entire screen
        if (constraints?.video?.displaySurface === 'monitor' || 
            constraints?.video?.displaySurface === 'application' ||
            !constraints) {
          console.log('✅ Returning full screen mock');
          return Promise.resolve(createEnhancedMockStream());
        }
        
        // Fallback to original for other cases
        return originalGetDisplayMedia.call(this, constraints);
      };
      
      // Also override older APIs
      if (navigator.getDisplayMedia) {
        navigator.getDisplayMedia = function(constraints) {
          console.log('✅ INTERCEPTED: navigator.getDisplayMedia');
          return Promise.resolve(createEnhancedMockStream());
        };
      }
      
      if (navigator.webkitGetDisplayMedia) {
        navigator.webkitGetDisplayMedia = function(constraints) {
          console.log('✅ INTERCEPTED: webkitGetDisplayMedia');
          return Promise.resolve(createEnhancedMockStream());
        };
      }
    }
    
    // Override MediaDevices prototype
    if (window.MediaDevices && window.MediaDevices.prototype) {
      window.MediaDevices.prototype.getDisplayMedia = function(constraints) {
        console.log('✅ INTERCEPTED: MediaDevices.prototype.getDisplayMedia');
        return Promise.resolve(createEnhancedMockStream());
      };
    }
  };
  
  // Run immediately and on timer
  overrideAllMediaAPIs();
  setInterval(overrideAllMediaAPIs, 500);
  
  // Specifically patch your app's getUserScreenShare method
  const patchAppMethod = setInterval(() => {
    if (window.testService && window.testService.getUserScreenShare) {
      console.log('✅ Found testService.getUserScreenShare, patching...');
      
      const original = window.testService.getUserScreenShare;
      window.testService.getUserScreenShare = function() {
        console.log('✅ INTERCEPTED: testService.getUserScreenShare');
        const mockStream = createEnhancedMockStream();
        
        // Add some metadata to look like a real screen share
        mockStream.getTracks()[0].label = 'Screen 1 (Entire Screen)';
        
        return Promise.resolve({
          ...mockStream,
          getVideoTracks: () => [{
            ...mockStream.getVideoTracks()[0],
            getSettings: () => ({
              width: 3840,
              height: 1080,
              frameRate: 30,
              displaySurface: 'monitor',
              logicalSurface: true,
              cursor: 'motion'
            })
          }]
        });
      };
      
      clearInterval(patchAppMethod);
    }
  }, 100);
  
  // Override any permission checks
  const originalPermissionsQuery = navigator.permissions?.query;
  if (navigator.permissions) {
    navigator.permissions.query = function(perm) {
      if (perm.name === 'display-capture' || perm.name === 'screen-capture') {
        console.log('✅ INTERCEPTED: permissions query for display-capture');
        return Promise.resolve({ state: 'granted' });
      }
      return originalPermissionsQuery.call(this, perm);
    };
  }
  
  console.log('🔧 FULL SCREEN SHARE TEST HELPER - READY');
})();
