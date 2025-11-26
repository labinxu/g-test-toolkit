Java.perform(function () {
  try {
    var CertPinner = Java.use('okhttp3.CertificatePinner');
    console.log('[+] okhttp3.CertificatePinner found');

    // Java 签名：check(String host, List<Certificate> peerCertificates)
    try {
      CertPinner.check.overload('java.lang.String', 'java.util.List').implementation = function (host, certs) {
        console.log('[+] Bypass CertificatePinner.check(String, List) host =', host);
        return;
      };
      console.log('[+] Hooked CertificatePinner.check(String, List)');
    } catch (e) {
      console.log('[-] Cannot hook CertificatePinner.check(String, List):', e);
    }

    // Kotlin 常见签名：check$okhttp(String, java.util.List)
    try {
      CertPinner['check$okhttp'].overload('java.lang.String', 'java.util.List').implementation =
        function (host, certs) {
          console.log('[+] Bypass CertificatePinner.check$okhttp(String, List) host =', host);
          return;
        };
      console.log('[+] Hooked CertificatePinner.check$okhttp(String, List)');
    } catch (e) {
      console.log('[-] Cannot hook CertificatePinner.check$okhttp(String, List):', e);
    }

    // 你机器上报出来的签名：check$okhttp(String, kotlin.jvm.functions.Function0)
    try {
      Java.use('kotlin.jvm.functions.Function0'); // 确保类型已加载
      CertPinner['check$okhttp'].overload('java.lang.String', 'kotlin.jvm.functions.Function0').implementation =
        function (host, fn) {
          console.log('[+] Bypass CertificatePinner.check$okhttp(String, Function0) host =', host);
          return;
        };
      console.log('[+] Hooked CertificatePinner.check$okhttp(String, Function0)');
    } catch (e) {
      console.log('[-] Cannot hook CertificatePinner.check$okhttp(String, Function0):', e);
    }

  } catch (e) {
    console.log('[-] Error in ssl-bypass-gettr.js script:', e);
  }
});

