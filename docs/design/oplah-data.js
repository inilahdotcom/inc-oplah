(function(){
const MONTHS=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const MS=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const ROMAN=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
const TODAY='2026-09-25';
const rp=n=>Math.round(n||0).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');
const fdate=d=>{if(!d)return '—';const [y,m,dd]=d.split('-');return (+dd)+' '+MONTHS[+m-1]+' '+y;};
const fmon=(ym,s)=>{if(!ym)return '';const [y,m]=ym.split('-');return (s?MS:MONTHS)[+m-1]+' '+y;};
const tax=(sub,on)=>{sub=Math.max(0,parseInt(String(sub||'').replace(/\D/g,''))||0);if(!on)return{sub,dpp:0,ppn:0,total:sub};const dpp=Math.round(sub*11/12);const ppn=Math.round(dpp*12/100);return{sub,dpp,ppn,total:sub+ppn};};
const pad=n=>String(n).padStart(3,'0');
const uid=()=>Math.random().toString(36).slice(2,9);
const slug=s=>s.toLowerCase().replace(/\(.*?\)/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const BTS=[{code:'ARTIKEL_RILIS',name:'Artikel Rilis',short:'Artikel Rilis'},{code:'INSTAGRAM',name:'Instagram Feed',short:'Instagram'},{code:'INSTAGRAM_STORY',name:'Instagram Story',short:'IG Story'},{code:'TIKTOK',name:'TikTok',short:'TikTok'},{code:'FACEBOOK',name:'Facebook',short:'Facebook'},{code:'X',name:'X',short:'X'},{code:'VIDEOTORIAL_WEBSITE',name:'Videotorial Website',short:'Videotorial'}];
const SALES=[{id:'s1',name:'Bimo',code:'BMO',email:'bimo@inilah.com',active:true},{id:'s2',name:'Rina Maharani',code:'RNA',email:'rina@inilah.com',active:true},{id:'s3',name:'Dedi Kurniawan',code:'DDI',email:'dedi@inilah.com',active:true}];
const SIGNERS=[{role:'Dibuat oleh',name:'Sales pada MO',title:'Sales',stamp:false},{role:'Diketahui oleh',name:'Fitriyanti K',title:'SPV Marketing & Sales',stamp:false},{role:'Disetujui oleh',name:'Alvin Alverdian',title:'Chief Business Officer',stamp:true}];
const AD_TYPES=['Banner','Advertorial','Lipsus','Mikrosite','Artikel','Artikel + Backlink','Video'];
const COOP=['Full Barter','Semi Barter'];
const PLACEMENTS=['Halaman Depan','Halaman Detail','Halaman Kanal'];
const SPOT_WEB=['Billboard 970x250','Single Skyscraper 160x600','Full Skyscraper 2 (160x600)','Medium Rectangle 300x250','Leaderboard One 728x90','Full Leaderboard 970x90','Bottom Full Leaderboard 970x90','Sticky Footer 970x90','Pop-up Custom'];
const PTBA_TNC='Kerjasama ini tidak mencakup penjagaan narasi pemberitaan di Inilah.com, PTBA hanya membeli inventori rilis artikel.\nPembayaran pada bulan September 2026 setelah PKS selesai ditandatangan kedua pihak.\nWaktu operasional produksi konten pukul 09:00 - 21:00';
const TNC={'Standar':'Materi iklan diserahkan paling lambat 3 hari kerja sebelum tanggal tayang.\nRevisi materi maksimal 2 kali per konten.\nPembayaran paling lambat 30 hari setelah invoice diterima.\nWaktu operasional produksi konten pukul 09:00 - 21:00','Rilis artikel':PTBA_TNC};
const CLIENTS=[
{id:'c1',company:'PT Bukit Asam Tbk (PTBA)',pic:'(isi PIC)',email:'pic@example.com',phone:'0800000000',nik:'',address:'',city:'',postal:'',npwp:''},
{id:'c2',company:'Bank Nusantara Digital',pic:'Sarah Wijaya',email:'sarah.w@banknusantara.co.id',phone:'021 5550 1122',nik:'',address:'Jl. Jend. Sudirman Kav. 21',city:'Jakarta Selatan',postal:'12920',npwp:''},
{id:'c3',company:'PT Sinar Energi Terbarukan',pic:'Andi Pratama',email:'andi@sinarenergi.id',phone:'0812 8890 2231',nik:'',address:'Jl. MH Thamrin No. 8',city:'Jakarta Pusat',postal:'10230',npwp:''},
{id:'c4',company:'Dinas Pariwisata Jawa Barat',pic:'Nur Aisyah',email:'humas@disparjabar.go.id',phone:'022 420 6644',nik:'',address:'Jl. RE Martadinata No. 209',city:'Bandung',postal:'40114',npwp:''},
{id:'c5',company:'PT Kopi Nusantara Jaya',pic:'Reza Mahendra',email:'reza@kopinusantara.com',phone:'0813 1100 4455',nik:'',address:'',city:'Tangerang',postal:'',npwp:''},
{id:'c6',company:'PT Arunika Properti',pic:'Melati Hasan',email:'melati@arunika.co.id',phone:'0811 900 7788',nik:'',address:'',city:'Bekasi',postal:'',npwp:''},
{id:'c7',company:'Universitas Cakrawala',pic:'Hendra Gunawan',email:'humas@cakrawala.ac.id',phone:'021 788 3300',nik:'',address:'',city:'Depok',postal:'',npwp:''},
{id:'c8',company:'PT Maju Otomotif Indonesia',pic:'Kevin Santoso',email:'kevin@majuotomotif.co.id',phone:'0812 3456 7788',nik:'',address:'',city:'Jakarta Utara',postal:'',npwp:''},
{id:'c9',company:'CV Lestari Craft',pic:'Dewi Lestari',email:'dewi@lestaricraft.id',phone:'0857 2211 3344',nik:'',address:'',city:'Yogyakarta',postal:'',npwp:''},
{id:'c10',company:'PT Samudra Logistik',pic:'Bayu Saputra',email:'bayu@samudralog.co.id',phone:'031 889 1200',nik:'',address:'',city:'Surabaya',postal:'',npwp:''}];
const autoDetail=(bens)=>bens.filter(b=>b.code).map(b=>{const t=BTS.find(x=>x.code===b.code);return (t?t.name:b.code)+(b.notes?' ('+b.notes+')':'')+' '+(b.qty||0)+'x';}).join('\n');
const pubUrl=(code,co,i,id)=>{const s=slug(co);return ({ARTIKEL_RILIS:'https://www.inilah.com/'+s+'-rilis-'+(i+1),INSTAGRAM:'https://www.instagram.com/p/INL'+id+'F'+(i+1),INSTAGRAM_STORY:'https://www.instagram.com/stories/inilahcom/'+id+(i+1),TIKTOK:'https://www.tiktok.com/@inilahcom/video/'+id+(i+1),FACEBOOK:'https://www.facebook.com/inilahcom/posts/'+id+(i+1),X:'https://x.com/inilahcom/status/'+id+(i+1),VIDEOTORIAL_WEBSITE:'https://www.inilah.com/video/'+s+'-'+(i+1)})[code]||('https://www.inilah.com/'+s+'-'+(i+1));};
function mk(d){
  const c=CLIENTS.find(x=>x.id===d.cid);const s=SALES.find(x=>x.id===d.sid);
  const [y,m]=d.date.split('-').map(Number);
  const [py,pm]=d.ps.split('-').map(Number);const [ey,em]=d.pe.split('-').map(Number);
  const span=(ey-py)*12+(em-pm)+1;const avail=Math.max(1,Math.min(span,(2026-py)*12+(9-pm)+1));
  const pubs=[];
  d.ben.forEach(([code,qty,notes,real])=>{for(let i=0;i<real;i++){const mi=pm-1+Math.floor(i*avail/real);const dt=new Date(py,mi,1);const yy=dt.getFullYear(),mm=dt.getMonth()+1;let day=2+(i*7)%24;if(yy===2026&&mm===9)day=Math.min(day,20);const date=yy+'-'+String(mm).padStart(2,'0')+'-'+String(day).padStart(2,'0');const t=BTS.find(x=>x.code===code);pubs.push({id:uid(),code,date,title:t.name+' '+(i+1)+' · '+d.desc,url:pubUrl(code,c.company,i,d.seq||0),bonus:false,notes:''});}});
  const benefits=d.ben.map(([code,qty,notes])=>({k:uid(),code,qty,notes:notes||''}));
  const mo={id:d.id,seq:d.seq||null,number:d.seq?pad(d.seq)+'/MO-'+s.code+'/INC/'+ROMAN[m-1]+'/'+y:null,date:d.date,cid:c.id,pic:c.pic,company:c.company,nik:c.nik,address:c.address,city:c.city,postal:c.postal,email:c.email,phone:c.phone,
    sid:d.sid,ps:d.ps,pe:d.pe,desc:d.desc,airing:d.airing||'Sesuai jadwal',adTypes:d.adTypes||['Artikel'],coop:'',placements:d.placements||['Halaman Detail'],spotWeb:false,spotWebItems:[],spotMobile:false,
    benefits,detail:d.detail||autoDetail(benefits),detailManual:!!d.detail,terms:d.terms||TNC['Standar'],payMethod:'Transfer',chequeNo:'',receiptNo:'',due:d.due||'',product:d.product||'Publikasi digital',subtotal:String(d.sub),taxable:true,
    ack:'Fitriyanti K',app:'Alvin Alverdian',base:d.base,cancelReason:d.cancel||'',revOf:null,pubs,bills:[],attachments:d.att||[],
    log:[{t:fdate(d.date)+' 10:12',who:s.name,what:d.base==='DRAFT'?'Draft dibuat':'MO disubmit, nomor '+(d.seq?pad(d.seq):'')+' dikunci'}]};
  const total=tax(mo.subtotal,true).total;
  (d.bills||[]).forEach(b=>mo.bills.push({id:uid(),inv:b.inv,invDate:b.invDate,amount:Math.round(total*(b.frac||1)),paidDate:b.paidDate||'',paidAmount:b.paid?Math.round(total*(b.frac||1)):0,receipt:b.receipt||'',override:b.override||''}));
  if(d.base==='CANCELLED')mo.log.push({t:'10 Agustus 2026 14:20',who:s.name,what:'MO dibatalkan: '+d.cancel});
  return mo;
}
const MOS=[
 mk({id:'m1',seq:7,sid:'s1',date:'2026-05-22',cid:'c1',ps:'2026-06',pe:'2027-05',desc:'Publikasi Rilis Artikel',ben:[['ARTIKEL_RILIS',12,'Materi Ready To Post',4]],sub:20000000,base:'SUBMITTED',detail:'Artikel Release (Materi Ready To Post) 12x',terms:PTBA_TNC,product:'Artikel Rilis',airing:'Sesuai jadwal'}),
 mk({id:'m2',seq:1,sid:'s2',date:'2026-01-12',cid:'c2',ps:'2026-01',pe:'2026-03',desc:'Kampanye literasi keuangan digital',ben:[['ARTIKEL_RILIS',6,'',6],['INSTAGRAM',6,'',6]],sub:45000000,base:'SUBMITTED',bills:[{inv:'INV/INC/2026/0031',invDate:'2026-04-02',paidDate:'2026-04-20',paid:true,receipt:'KW-0112'}]}),
 mk({id:'m3',seq:2,sid:'s3',date:'2026-02-09',cid:'c3',ps:'2026-02',pe:'2026-07',desc:'Publikasi program energi hijau',ben:[['ARTIKEL_RILIS',10,'',10],['INSTAGRAM',5,'',5],['TIKTOK',5,'',5]],sub:60000000,base:'SUBMITTED'}),
 mk({id:'m4',seq:3,sid:'s1',date:'2026-03-04',cid:'c4',ps:'2026-03',pe:'2026-08',desc:'Promosi destinasi wisata',ben:[['VIDEOTORIAL_WEBSITE',2,'',1],['INSTAGRAM_STORY',10,'',7]],sub:35000000,base:'SUBMITTED',adTypes:['Video','Artikel'],bills:[{inv:'INV/INC/2026/0048',invDate:'2026-06-15',frac:0.5,override:'Termin 1 sesuai PKS (50%)'}]}),
 mk({id:'m5',seq:4,sid:'s2',date:'2026-03-18',cid:'c5',ps:'2026-04',pe:'2026-06',desc:'Peluncuran varian produk',ben:[['INSTAGRAM',8,'',8],['FACEBOOK',8,'',8],['X',8,'',8]],sub:24000000,base:'SUBMITTED',bills:[{inv:'INV/INC/2026/0052',invDate:'2026-07-03',paidDate:'2026-07-28',paid:true,receipt:'KW-0147'}]}),
 mk({id:'m6',seq:5,sid:'s3',date:'2026-04-07',cid:'c6',ps:'2026-04',pe:'2026-09',desc:'Publikasi proyek hunian',ben:[['ARTIKEL_RILIS',8,'',4],['INSTAGRAM',4,'',2]],sub:30000000,base:'SUBMITTED'}),
 mk({id:'m7',seq:6,sid:'s1',date:'2026-05-06',cid:'c7',ps:'2026-05',pe:'2026-07',desc:'Penerimaan mahasiswa baru',ben:[['ARTIKEL_RILIS',4,'',4]],sub:12000000,base:'SUBMITTED'}),
 mk({id:'m8',seq:8,sid:'s2',date:'2026-06-10',cid:'c8',ps:'2026-06',pe:'2026-11',desc:'Kampanye mobil listrik',ben:[['TIKTOK',6,'',0],['X',6,'',0]],sub:40000000,base:'SUBMITTED'}),
 mk({id:'m9',seq:9,sid:'s3',date:'2026-07-02',cid:'c9',ps:'2026-08',pe:'2026-10',desc:'Pameran kriya',ben:[['INSTAGRAM',4,'',0]],sub:8000000,base:'CANCELLED',cancel:'Klien menunda kampanye'}),
 mk({id:'m10',seq:null,sid:'s1',date:'2026-09-22',cid:'c10',ps:'2026-10',pe:'2027-03',desc:'Publikasi layanan logistik',ben:[['ARTIKEL_RILIS',6,'',0]],sub:18000000,base:'DRAFT'})
];
window.OPLAH={MONTHS,MS,ROMAN,TODAY,rp,fdate,fmon,tax,pad,uid,BTS,SALES,SIGNERS,AD_TYPES,COOP,PLACEMENTS,SPOT_WEB,TNC,CLIENTS,MOS,autoDetail};
})();
