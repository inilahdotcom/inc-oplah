// Pipeline CI/CD inc-oplah: bangun dua image (api + web) dari branch yang dipantau
// job, dorong ke Harbor, pindai dengan Trivy milik Harbor, lalu jalankan di VM
// tujuan lewat SSH. Domain diarahkan ke container web oleh nginx di VM
// (reverse proxy -> VM:PORT); web mem-proxy /api/ ke container api.
//
// Tiap build mendorong dua tag per image:
//   <nomor build>-<commit 7 karakter>   contoh :12-8f07143  tetap, untuk dilacak balik ke kode
//   <nama branch>                       contoh :staging     selalu menunjuk build terakhir
//
// Susunan di VM:
//   inc-oplah-web  network APP_NETWORK, publish BIND:PORT -> 80
//   inc-oplah-api  network APP_NETWORK (alias `api`, dipakai nginx.conf) + DB_NETWORK,
//                  port 4000 TIDAK dibuka ke host. Migrasi Prisma jalan saat container start.
//
// KREDENSIAL YANG HARUS SUDAH ADA DI JENKINS:
//   robothb         Username with password         robot Harbor (push + scan untuk Jenkins, pull untuk VM)
//   vm-deploy       SSH Username with private key  kunci SSH ke VM tujuan
//   inc-oplah-env   Secret file                    isi .env api, dipakai `docker run --env-file`
//                                                  DATABASE_URL=postgresql://USER:PASS@postgres_db:5432/inc_mo
//                                                  (host = nama container PostgreSQL, dijangkau lewat
//                                                  network DB_NETWORK, bukan lewat IP VM)
//                                                  Nilai TANPA tanda petik: `docker run --env-file` tidak
//                                                  membuangnya seperti compose, jadi "abc" terbaca "abc"
//                                                  lengkap dengan petiknya.
//                                                  NODE_ENV, PORT, PUPPETEER_EXECUTABLE_PATH dipaksa oleh
//                                                  `-e` di bawah (nilai kosong di .env akan menimpa ENV image).
//
// Image web tidak butuh .env: VITE_API_BASE_URL=/api/v1 sudah ditanam di docker/web.Dockerfile.

pipeline {
    agent any

    // Dipicu webhook GitHub push. Webhook repo inilahdotcom/inc-oplah harus
    // diarahkan ke https://jk.inilahtv.com/github-webhook/ dengan secret yang sama
    // (github-webhook-secret).
    triggers {
        githubPush()
    }

    options {
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '20'))
        // Deploy tidak boleh berjalan berbarengan - dua build sekaligus akan
        // saling menimpa container di VM tujuan.
        disableConcurrentBuilds()
    }

    environment {
        REGISTRY  = 'hb.inilahtv.com'
        IMAGE_API = 'hb.inilahtv.com/inilah/inc-oplah-api'
        IMAGE_WEB = 'hb.inilahtv.com/inilah/inc-oplah-web'

        VM   = '12.105.0.1'
        PORT = '4001'                 // port web di VM; nginx reverse proxy menembak ke sini
        BIND = '0.0.0.0'              // semua interface, agar reverse proxy dari mesin lain bisa menjangkau
        APP_API = 'inc-oplah-api'     // nama container di VM tujuan
        APP_WEB = 'inc-oplah-web'
        // Network docker milik container PostgreSQL di VM (dibuat compose-nya).
        // Harus sudah ada sebelum deploy.
        DB_NETWORK  = 'postgresql_default'
        // Network web <-> api; dibuat otomatis bila belum ada.
        APP_NETWORK = 'inc-oplah'
    }

    stages {

        stage('Info') {
            steps {
                script {
                    env.SHA    = sh(script: 'git rev-parse --short=7 HEAD', returnStdout: true).trim()
                    env.TAG    = "${env.BUILD_NUMBER}-${env.SHA}"
                    // Job Pipeline biasa mengisi GIT_BRANCH dengan "origin/<branch>".
                    env.BRANCH = sh(script: 'echo "${GIT_BRANCH#origin/}"', returnStdout: true).trim()
                }
                sh '''
                    echo "branch : $BRANCH"
                    echo "commit : $SHA - $(git log -1 --pretty=%s)"
                    echo "image  : $IMAGE_API:$TAG, $IMAGE_WEB:$TAG (+ tag $BRANCH)"
                    echo "tujuan : $VM ($BIND:$PORT -> web, api via network $DB_NETWORK)"
                '''
            }
        }

        stage('Bangun image') {
            steps {
                sh '''
                    set -eu
                    docker build -f docker/api.Dockerfile -t ${IMAGE_API}:${TAG} -t ${IMAGE_API}:${BRANCH} .
                    docker build -f docker/web.Dockerfile -t ${IMAGE_WEB}:${TAG} -t ${IMAGE_WEB}:${BRANCH} .
                '''
            }
        }

        stage('Dorong ke Harbor') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'robothb',
                                                  usernameVariable: 'HU',
                                                  passwordVariable: 'HP')]) {
                    sh '''
                        set -eu
                        echo "$HP" | docker login ${REGISTRY} -u "$HU" --password-stdin
                        for I in ${IMAGE_API} ${IMAGE_WEB}; do
                            docker push $I:${TAG}
                            docker push $I:${BRANCH}
                        done
                    '''
                }
            }
        }

        // Hanya melapor: temuan CVE maupun scan yang gagal TIDAK menghentikan
        // deploy. Ringkasannya ikut dikirim ke Telegram lewat kabari().
        stage('Scan Trivy') {
            steps {
                script {
                    // Loop for biasa, bukan .each { }: closure di pipeline CPS rawan bermasalah.
                    def hasil = []
                    for (i in [['api', env.IMAGE_API], ['web', env.IMAGE_WEB]]) {
                        hasil << "<b>${i[0]}</b>\n" + scan(i[1])
                    }
                    env.SCAN = hasil.join('\n\n')
                }
            }
        }

        stage('Deploy ke VM') {
            steps {
                withCredentials([
                    sshUserPrivateKey(credentialsId: 'vm-deploy',
                                      keyFileVariable: 'KUNCI',
                                      usernameVariable: 'SSHUSER'),
                    usernamePassword(credentialsId: 'robothb',
                                     usernameVariable: 'RU',
                                     passwordVariable: 'RP'),
                    file(credentialsId: 'inc-oplah-env', variable: 'ENV_FILE')
                ]) {
                    sh '''
                        set -eu
                        kirim() {
                            ssh -i "$KUNCI" -o StrictHostKeyChecking=accept-new \
                                -o ConnectTimeout=10 "$SSHUSER@$VM" "$@"
                        }

                        SEBELUM=$(kirim "docker inspect -f '{{.Config.Image}}' $APP_API 2>/dev/null || true")
                        echo "versi api sebelumnya di $VM: ${SEBELUM:-(belum ada, ini deploy pertama)}"

                        # .env dikirim lewat stdin ke file sementara di VM. umask 077
                        # membuatnya langsung hanya bisa dibaca pemiliknya, dan isinya
                        # tidak pernah muncul di Console Output maupun di `ps`.
                        ENV_VM=$(kirim 'umask 077; f=$(mktemp); cat > "$f"; echo "$f"' < "$ENV_FILE")

                        # Heredoc TANPA petik: $RP dan $ENV_VM disisipkan di sini, jadi
                        # rahasianya mengalir lewat stdin, bukan argumen perintah.
                        kirim 'bash -s' <<EOF
set -eu
# Berkas .env dan login Harbor dibersihkan apa pun hasilnya. Nilai env sudah
# tersimpan di dalam container, jadi restart tidak butuh berkas ini lagi.
trap "rm -f '$ENV_VM'; docker logout '$REGISTRY' >/dev/null 2>&1 || true" EXIT

echo '$RP' | docker login '$REGISTRY' -u '$RU' --password-stdin
docker pull '$IMAGE_API:$TAG'
docker pull '$IMAGE_WEB:$TAG'

# Dicek SEBELUM container lama dihapus - kalau network DB tidak ada, api pasti
# gagal konek dan layanan akan mati tanpa pengganti.
if ! docker network inspect '$DB_NETWORK' >/dev/null 2>&1; then
    echo "network $DB_NETWORK tidak ada di $VM - container lama dibiarkan jalan"
    exit 1
fi
docker network inspect '$APP_NETWORK' >/dev/null 2>&1 || docker network create '$APP_NETWORK' >/dev/null

# ---- api ----
docker rm -f '$APP_API' >/dev/null 2>&1 || true
# create -> connect -> start: network DB harus tersambung SEBELUM migrasi Prisma
# jalan saat container start (docker run hanya bisa memasang satu network).
docker create --name '$APP_API' --restart unless-stopped \
    --network '$APP_NETWORK' --network-alias api \
    --env-file '$ENV_VM' -e NODE_ENV=production -e PORT=4000 \
    -e PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    --log-driver json-file --log-opt max-size=3m --log-opt max-file=3 \
    '$IMAGE_API:$TAG' >/dev/null
docker network connect '$DB_NETWORK' '$APP_API'
docker start '$APP_API' >/dev/null

# Migrasi Prisma + start server; tunggu sampai /health (yang juga query DB) OK.
SEHAT=
for i in \\$(seq 30); do
    if docker exec '$APP_API' node -e "fetch('http://127.0.0.1:4000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
        SEHAT=1; break
    fi
    sleep 3
done
if [ -z "\\$SEHAT" ]; then
    echo "container $APP_API tidak sehat"; docker logs --tail 80 '$APP_API'; exit 1
fi
echo "container $APP_API jalan dari $IMAGE_API:$TAG"

# ---- web ----
docker rm -f '$APP_WEB' >/dev/null 2>&1 || true
docker run -d --name '$APP_WEB' --restart unless-stopped \
    --network '$APP_NETWORK' \
    -p $BIND:$PORT:80 \
    --log-driver json-file --log-opt max-size=3m --log-opt max-file=3 \
    '$IMAGE_WEB:$TAG' >/dev/null

# Halaman dan proxy /api/ harus sama-sama melayani sebelum dianggap berhasil
# (wget bawaan busybox di image nginx:alpine).
for i in 1 2 3 4 5; do
    if docker exec '$APP_WEB' wget -q -O /dev/null http://127.0.0.1/ \
       && docker exec '$APP_WEB' wget -q -O /dev/null http://127.0.0.1/api/v1/health; then
        echo "container $APP_WEB jalan di $VM ($BIND:$PORT) dari $IMAGE_WEB:$TAG"
        exit 0
    fi
    sleep 2
done
echo "container $APP_WEB tidak merespons"; docker logs --tail 50 '$APP_WEB'; exit 1
EOF
                    '''
                }
            }
        }
    }

    post {
        always {
            sh '''
                docker logout ${REGISTRY} >/dev/null 2>&1 || true
                docker rmi ${IMAGE_API}:${TAG} ${IMAGE_API}:${BRANCH} \
                           ${IMAGE_WEB}:${TAG} ${IMAGE_WEB}:${BRANCH} >/dev/null 2>&1 || true
            '''
        }
        success { script { kabari('✅ BERHASIL') } }
        aborted { script { kabari('⚠️ DIBATALKAN') } }
        failure {
            echo "Build gagal. Container lama di ${VM} TIDAK diubah kalau kegagalannya terjadi sebelum tahap Deploy."
            script { kabari('❌ GAGAL') }
        }
    }
}

// Memindai satu image (tag TAG) dengan Trivy milik Harbor dan mengembalikan
// ringkasan untuk Telegram. Gagal scan tidak menghentikan build.
def scan(String image) {
    try {
        withCredentials([usernamePassword(credentialsId: 'robothb',
                                          usernameVariable: 'HU',
                                          passwordVariable: 'HP')]) {
            withEnv(["SCAN_IMAGE=${image}"]) {
                sh '''
                    set -eu
                    rm -f scan.json
                    P=${SCAN_IMAGE#*/}
                    A="https://${REGISTRY}/api/v2.0/projects/${P%%/*}/repositories/${P#*/}/artifacts/${TAG}"

                    # Kredensial masuk ke curl lewat stdin (-K -), bukan argumen,
                    # jadi tidak terlihat di `ps`.
                    harbor() {
                        printf 'user = "%s:%s"\\n' "$HU" "$HP" | curl -sS -m 20 --fail -K - "$@"
                    }

                    harbor -X POST -o /dev/null "$A/scan"

                    # Tanpa header ini Harbor tidak menyertakan scan_overview.
                    for i in $(seq 60); do
                        sleep 10
                        harbor -o scan.json \
                            -H 'X-Accept-Vulnerabilities: application/vnd.security.vulnerability.report; version=1.1' \
                            "$A?with_scan_overview=true"
                        grep -q -E '"scan_status":"(Success|Error|Stopped)"' scan.json && break
                    done
                '''
            }
        }

        def a = readJSON file: 'scan.json'
        def r = a.scan_overview?.get('application/vnd.security.vulnerability.report; version=1.1')
        def url = "https://${env.REGISTRY}/harbor/projects/${a.project_id}/repositories/" +
                  "${a.repository_name.split('/', 2)[1]}/artifacts-tab/artifacts/${a.digest}"
        if (r?.scan_status != 'Success') {
            return "tidak selesai (status: ${r?.scan_status ?: '-'}) · <a href=\"${url}\">detail</a>"
        }
        // Harbor tidak menyertakan tingkat yang jumlahnya 0.
        // Satu tingkat per baris supaya mudah dibaca di Telegram.
        def s = r.summary?.summary ?: [:]
        def ringkas = ['Critical', 'High', 'Medium', 'Low', 'Unknown']
            .collect { "• ${it.toUpperCase()}: ${s[it] ?: 0}" }
            .join('\n') + "\n• bisa diperbaiki: ${r.summary?.fixable ?: 0}"
        echo "Hasil scan ${image}: ${ringkas}"
        return "${ringkas}\n<a href=\"${url}\">detail</a>"
    } catch (org.jenkinsci.plugins.workflow.steps.FlowInterruptedException e) {
        throw e    // build dibatalkan atau kena timeout - jangan ditelan
    } catch (e) {
        echo "Scan Trivy ${image} gagal: ${e.message}"
        return 'gagal dijalankan, lihat log'
    }
}

// Mengirim hasil build ke Telegram. Token, chat id, dan thread id diambil dari
// credential Jenkins - tidak satu pun ditulis di berkas ini:
//   telegram-bot-token   Secret text
//   telegram-chat-id     Secret text
//   telegram-thread-id   Secret text
def kabari(String status) {
    try {
        withCredentials([
            string(credentialsId: 'telegram-bot-token', variable: 'TG_TOKEN'),
            string(credentialsId: 'telegram-chat-id',   variable: 'TG_CHAT'),
            string(credentialsId: 'telegram-thread-id', variable: 'TG_THREAD')
        ]) {
            def pesan = """<b>${status}</b> · ${env.JOB_NAME} #${env.BUILD_NUMBER}
<b>commit</b> <code>${env.SHA ?: '-'}</code> · ${env.BRANCH ?: '-'}
<b>durasi</b> ${currentBuild.durationString.replace(' and counting', '')}"""
            // Bagian scan hanya muncul kalau tahap Scan Trivy sempat dijalankan.
            if (env.SCAN) {
                pesan += "\n\n🛡 <b>Hasil scan Trivy</b>\n${env.SCAN}\n"
            }
            pesan += "\n<a href=\"${env.BUILD_URL}console\">Lihat log</a>"

            // Skrip sh berpetik TUNGGAL: shell yang mengembangkan $TG_TOKEN, bukan
            // Groovy, supaya token tidak ikut tertulis ke skrip.
            withEnv(["PESAN=${pesan}"]) {
                sh(label: 'kirim notifikasi Telegram', script: '''
                    curl -sS -m 15 -o /dev/null \
                      "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
                      --data-urlencode "chat_id=${TG_CHAT}" \
                      --data-urlencode "message_thread_id=${TG_THREAD}" \
                      --data-urlencode "parse_mode=HTML" \
                      --data-urlencode "disable_web_page_preview=true" \
                      --data-urlencode "text=${PESAN}"
                ''')
            }
        }
    } catch (e) {
        // Gagal mengirim notifikasi tidak boleh mengubah hasil build.
        echo "Notifikasi Telegram gagal: ${e.message}"
    }
}
