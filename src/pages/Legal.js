import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { EMPRESA } from '../utils/empresa';

const TURQ    = '#0abfbc';
const TURQ2   = '#00d4d0';
const TURQ_DK = '#089a97';
const DARK    = '#1a2e2e';

/* ─────────────────────────────────────────────────────────────
   PÁGINAS LEGALES PÚBLICAS
   /terminos · /privacidad · /aviso-legal
   Marco normativo: Constitución de la República Bolivariana de
   Venezuela (arts. 28, 60 y 117), Decreto-Ley sobre Mensajes de
   Datos y Firmas Electrónicas, Ley Especial contra los Delitos
   Informáticos, Ley Orgánica de Precios Justos, Ley sobre el
   Derecho de Autor, Ley de Propiedad Industrial y LOPNNA.
───────────────────────────────────────────────────────────── */

const DOCS = [
  { path: '/terminos',    label: 'Términos y Condiciones' },
  { path: '/privacidad',  label: 'Política de Privacidad' },
  { path: '/aviso-legal', label: 'Aviso Legal' },
];

const titular = EMPRESA.razonSocial
  ? `${EMPRESA.razonSocial}${EMPRESA.rif ? ` (RIF ${EMPRESA.rif})` : ''}`
  : EMPRESA.nombreComercial;

const canalesContacto = [
  EMPRESA.correo   && `correo electrónico ${EMPRESA.correo}`,
  EMPRESA.whatsapp && `WhatsApp ${EMPRESA.whatsapp}`,
].filter(Boolean).join(' o ') || 'los canales de contacto publicados en este sitio (WhatsApp)';

/* ── Bloques de contenido ── */
const S = ({ n, t, children }) => (
  <section style={{ marginBottom: 30 }}>
    <h2 style={{ fontSize: '1.1rem', color: DARK, fontWeight: 700, marginBottom: 10 }}>
      <span style={{ color: TURQ_DK }}>{n}.</span> {t}
    </h2>
    {children}
  </section>
);
const P  = ({ children }) => <p style={{ fontSize: '.92rem', color: `${DARK}cc`, lineHeight: 1.75, margin: '0 0 10px' }}>{children}</p>;
const UL = ({ items }) => (
  <ul style={{ fontSize: '.92rem', color: `${DARK}cc`, lineHeight: 1.75, margin: '0 0 10px', paddingLeft: 22 }}>
    {items.map((it, i) => <li key={i} style={{ marginBottom: 4 }}>{it}</li>)}
  </ul>
);

/* ═════════════════ TÉRMINOS Y CONDICIONES ═════════════════ */
function Terminos() {
  return (
    <>
      <P>
        Estos Términos y Condiciones regulan el acceso y uso del sitio web {EMPRESA.sitioWeb} y la participación en las
        rifas organizadas por <strong>{titular}</strong>, bajo la marca <strong>{EMPRESA.marca}</strong> (en adelante,
        “el Organizador”). Al navegar por el sitio, reservar un número o enviar un comprobante de pago, usted declara
        haber leído y aceptado estos términos. Conforme al Decreto con Fuerza de Ley sobre Mensajes de Datos y Firmas
        Electrónicas, la aceptación manifestada por medios electrónicos tiene la misma validez que la otorgada por escrito.
      </P>

      <S n="1" t="Requisitos para participar">
        <UL items={[
          'Ser mayor de 18 años y tener plena capacidad legal. De acuerdo con la Ley Orgánica para la Protección de Niños, Niñas y Adolescentes, está prohibida la participación de menores de edad en juegos de azar.',
          'Suministrar datos personales verdaderos, completos y actualizados (nombre, cédula de identidad y teléfono). El Organizador puede anular reservas con datos falsos o incompletos.',
          'Participar a título personal. Cada participante es responsable de la veracidad de la información y del comprobante que envía.',
        ]} />
      </S>

      <S n="2" t="Proceso de compra">
        <UL items={[
          'El participante selecciona uno o varios números disponibles, realiza el pago por alguno de los métodos publicados en el sitio y adjunta el comprobante junto con sus datos.',
          'Al enviar el formulario, los números quedan reservados de forma provisional. La compra solo se considera confirmada cuando el Organizador verifica que el pago fue recibido en su totalidad en las cuentas oficiales publicadas en este sitio.',
          'Si el pago no puede verificarse, es parcial o el comprobante es inválido, la reserva podrá anularse y los números quedarán nuevamente disponibles.',
          'Una vez verificado el pago, el ticket se envía al participante por WhatsApp al número suministrado.',
          'El Organizador no responde por pagos realizados a cuentas, personas o canales distintos a los publicados oficialmente en este sitio.',
        ]} />
      </S>

      <S n="3" t="Precios, ofertas y tasas de cambio">
        <P>
          Los precios se expresan en pesos colombianos (COP). Las equivalencias en bolívares (Bs.) o dólares (USD) se
          calculan con la tasa del día publicada en el sitio al momento de la compra y son referenciales. Las ofertas por
          paquetes de números aplican únicamente en las condiciones indicadas en cada rifa y no son acumulables salvo que
          se indique lo contrario. Los precios incluyen la información exigida por la Ley Orgánica de Precios Justos.
        </P>
      </S>

      <S n="4" t="Sorteo y determinación del ganador">
        <UL items={[
          'Cada rifa indica su premio, precio por número, fecha y hora del sorteo y, cuando aplique, la lotería oficial cuyo resultado determina el número ganador.',
          'Resulta ganador el número que coincida con el resultado oficial indicado, siempre que haya sido pagado y verificado antes del sorteo. Los números reservados sin pago verificado no participan.',
          'Si la lotería de referencia no realiza el sorteo en la fecha prevista, se tomará el resultado del siguiente sorteo oficial de esa misma lotería.',
          'El Organizador podrá reprogramar la fecha del sorteo por causas justificadas o de fuerza mayor, notificándolo por el sitio web y/o WhatsApp con la debida antelación.',
        ]} />
      </S>

      <S n="5" t="Entrega del premio">
        <UL items={[
          'El ganador será contactado al teléfono registrado. Para reclamar el premio deberá presentar su cédula de identidad y el ticket o ID de reserva, y la identidad deberá coincidir con los datos de la compra.',
          'El premio deberá reclamarse dentro del plazo indicado en la rifa o, en su defecto, dentro de los treinta (30) días continuos siguientes al sorteo.',
          'El premio es personal e intransferible y no es canjeable por dinero u otros bienes, salvo acuerdo expreso con el Organizador.',
          'Los tributos, gastos de traspaso, registro o traslado asociados al premio corren por cuenta del ganador, salvo que la rifa indique lo contrario, conforme a la legislación tributaria vigente.',
        ]} />
      </S>

      <S n="6" t="Cancelaciones y reembolsos">
        <P>
          Una vez verificado el pago, la compra de números no admite devolución ni cambio, dada la naturaleza aleatoria
          del sorteo. Si el Organizador cancela una rifa, los participantes con pago verificado podrán elegir entre el
          reembolso del monto pagado o el traslado de sus números a otra rifa equivalente.
        </P>
      </S>

      <S n="7" t="Uso permitido del sitio">
        <P>Al usar el sitio, el usuario se compromete a no:</P>
        <UL items={[
          'Enviar comprobantes de pago falsos, alterados o de terceros sin autorización.',
          'Suplantar la identidad de otra persona ni usar datos personales ajenos.',
          'Intentar acceder sin autorización a áreas restringidas, sistemas o bases de datos, ni interferir con el funcionamiento del sitio (ataques, automatización masiva, extracción de datos).',
          'Usar el sitio con fines ilícitos o contrarios a estos términos.',
        ]} />
        <P>
          Estas conductas pueden constituir delitos tipificados en la Ley Especial contra los Delitos Informáticos y en
          el Código Penal. El Organizador anulará las reservas involucradas y podrá denunciarlas ante las autoridades competentes.
        </P>
      </S>

      <S n="8" t="Limitación de responsabilidad">
        <P>El Organizador procura mantener el sitio disponible y con información exacta, pero no garantiza un servicio ininterrumpido ni libre de errores. No será responsable por:</P>
        <UL items={[
          'Fallas técnicas, caídas del servidor, interrupciones de conectividad o de energía eléctrica, ni errores de software ajenos a su control razonable.',
          'Retrasos o rechazos atribuibles a bancos, plataformas de pago o servicios de mensajería (incluido WhatsApp).',
          'Errores en los datos suministrados por el participante (por ejemplo, un teléfono incorrecto que impida el contacto).',
          'Daños derivados del uso indebido del sitio por parte del usuario o de terceros.',
        ]} />
        <P>
          Si por una falla técnica un mismo número quedara asignado a más de un participante, prevalecerá el primer pago
          verificado, y el otro participante podrá elegir un número disponible o solicitar el reembolso.
        </P>
      </S>

      <S n="9" t="Propiedad intelectual">
        <P>
          Los nombres {EMPRESA.nombreComercial} y {EMPRESA.marca}, los logotipos, diseños, textos, imágenes, tickets y el
          software de este sitio son propiedad del Organizador o se usan con autorización, y están protegidos por la Ley
          sobre el Derecho de Autor y la Ley de Propiedad Industrial. Queda prohibida su reproducción, distribución o
          modificación sin autorización previa y por escrito.
        </P>
      </S>

      <S n="10" t="Datos personales">
        <P>
          El tratamiento de los datos personales se rige por nuestra{' '}
          <Link to="/privacidad" style={{ color: TURQ_DK, fontWeight: 600 }}>Política de Privacidad</Link>.
        </P>
      </S>

      <S n="11" t="Modificaciones">
        <P>
          El Organizador puede modificar estos términos en cualquier momento. Los cambios se publicarán en esta página
          con su fecha de actualización y no afectarán las compras ya confirmadas.
        </P>
      </S>

      <S n="12" t="Ley aplicable y jurisdicción">
        <P>
          Estos términos se rigen por las leyes de la República Bolivariana de Venezuela. Las partes procurarán resolver
          cualquier controversia de forma amistosa; de no ser posible, se someterán a los tribunales competentes de {EMPRESA.jurisdiccion},
          sin perjuicio de los derechos que la ley reconoce a los consumidores y usuarios.
        </P>
      </S>

      <S n="13" t="Contacto">
        <P>Para consultas o reclamos puede escribirnos por {canalesContacto}.</P>
      </S>
    </>
  );
}

/* ═════════════════ POLÍTICA DE PRIVACIDAD ═════════════════ */
function Privacidad() {
  return (
    <>
      <P>
        En <strong>{titular}</strong> ({EMPRESA.marca}) respetamos su privacidad. Esta política explica qué datos
        recopilamos, para qué los usamos y cómo los protegemos, en cumplimiento del derecho a la protección de datos
        (habeas data) y al honor y la vida privada reconocidos en los artículos 28 y 60 de la Constitución de la
        República Bolivariana de Venezuela.
      </P>

      <S n="1" t="Responsable del tratamiento">
        <P>
          El responsable de sus datos es {titular}, con domicilio en {EMPRESA.domicilio}. Puede contactarnos por {canalesContacto}.
        </P>
      </S>

      <S n="2" t="Datos que recopilamos">
        <UL items={[
          <><strong>Datos de identificación:</strong> nombre completo y número de cédula.</>,
          <><strong>Datos de contacto:</strong> número de teléfono (WhatsApp) y, de forma opcional, correo electrónico.</>,
          <><strong>Datos de la compra:</strong> rifa, números elegidos, método de pago, monto y la imagen del comprobante de pago (que puede contener datos bancarios parciales).</>,
          <><strong>Datos técnicos:</strong> dirección IP y datos básicos del navegador que los servidores registran de forma automática por razones de seguridad y funcionamiento.</>,
        ]} />
        <P>No solicitamos contraseñas bancarias, claves de tarjetas ni códigos de verificación. Nunca comparta esa información con nadie que diga representarnos.</P>
      </S>

      <S n="3" t="Para qué usamos sus datos">
        <UL items={[
          'Reservar sus números y verificar su pago.',
          'Enviarle su ticket y notificaciones sobre la rifa por WhatsApp o correo.',
          'Identificar y contactar al ganador y entregar el premio.',
          'Prevenir fraudes, comprobantes falsos y suplantaciones de identidad.',
          'Cumplir obligaciones legales, contables y tributarias, y atender requerimientos de autoridades competentes.',
        ]} />
        <P>No usamos sus datos para publicidad de terceros ni tomamos decisiones automatizadas que le afecten.</P>
      </S>

      <S n="4" t="Base del tratamiento y consentimiento">
        <P>
          Tratamos sus datos con base en su consentimiento, que usted otorga al marcar la casilla de aceptación y enviar
          el formulario de compra, y en la necesidad de ejecutar la relación de compra de números. Puede revocar su
          consentimiento en cualquier momento, sin efecto retroactivo; sin embargo, sin estos datos no es posible
          participar ni entregar un premio.
        </P>
      </S>

      <S n="5" t="Publicación de ganadores">
        <P>
          Por transparencia del sorteo, podemos publicar el número ganador junto con el nombre de pila y la inicial del
          apellido del ganador. Nunca publicamos su cédula, teléfono ni comprobante. Si desea que no se publique su
          nombre, indíquelo al reclamar el premio.
        </P>
      </S>

      <S n="6" t="Con quién compartimos sus datos">
        <P>No vendemos ni alquilamos sus datos. Solo los compartimos con:</P>
        <UL items={[
          'Proveedores de alojamiento y bases de datos que prestan el servicio técnico del sitio, bajo deber de confidencialidad.',
          'WhatsApp (Meta Platforms), cuando le enviamos su ticket o mensajes por ese medio.',
          'Autoridades administrativas o judiciales, cuando exista una orden o una obligación legal.',
        ]} />
        <P>
          Algunos de estos proveedores pueden almacenar datos fuera de Venezuela. En esos casos procuramos que ofrezcan
          niveles de seguridad adecuados.
        </P>
      </S>

      <S n="7" t="Cookies y almacenamiento en el navegador">
        <P>
          Este sitio no usa cookies de publicidad ni de seguimiento. Solo puede usar almacenamiento técnico del navegador
          necesario para su funcionamiento. Las fuentes tipográficas se cargan desde Google Fonts, lo que implica que su
          navegador se conecta a servidores de Google.
        </P>
      </S>

      <S n="8" t="Cómo protegemos sus datos">
        <UL items={[
          'Conexión cifrada (HTTPS) entre su navegador y nuestros servidores.',
          'Acceso a los datos restringido al personal autorizado mediante usuario y contraseña.',
          'Los comprobantes solo se usan para verificar el pago y no se publican.',
        ]} />
        <P>
          Ningún sistema es completamente invulnerable. Si ocurriera un incidente de seguridad que afecte sus datos, le
          informaremos por los medios de contacto que nos suministró.
        </P>
      </S>

      <S n="9" t="Tiempo de conservación">
        <P>
          Conservamos sus datos mientras la rifa esté activa y, después, durante el tiempo necesario para atender
          reclamos y cumplir los plazos que exige la legislación mercantil y tributaria venezolana. Transcurrido ese
          plazo, los eliminamos o anonimizamos.
        </P>
      </S>

      <S n="10" t="Sus derechos (habeas data)">
        <P>Usted puede, en cualquier momento:</P>
        <UL items={[
          'Conocer qué datos suyos tenemos y para qué los usamos (acceso).',
          'Pedir que se corrijan o actualicen si son inexactos (rectificación).',
          'Solicitar su eliminación cuando ya no sean necesarios o hayan sido tratados indebidamente (supresión).',
          'Revocar su consentimiento u oponerse a un uso determinado.',
        ]} />
        <P>
          Para ejercerlos, escríbanos por {canalesContacto} indicando su nombre y cédula. Responderemos en un plazo no
          mayor de quince (15) días hábiles. Si considera que sus derechos no fueron atendidos, puede acudir a los
          órganos jurisdiccionales mediante la acción de habeas data.
        </P>
        <P>
          Si usted reside fuera de Venezuela (por ejemplo, en Colombia o en la Unión Europea), también le asisten los
          derechos que le reconozca su legislación local, incluidos la Ley 1581 de 2012 de Colombia o el Reglamento
          General de Protección de Datos (RGPD), y puede ejercerlos por los mismos canales.
        </P>
      </S>

      <S n="11" t="Menores de edad">
        <P>El sitio no está dirigido a menores de 18 años y no recopilamos a sabiendas sus datos. Si detectamos una reserva de un menor, la anularemos y eliminaremos sus datos.</P>
      </S>

      <S n="12" t="Cambios a esta política">
        <P>Podemos actualizar esta política. Publicaremos la nueva versión en esta página con su fecha de actualización.</P>
      </S>
    </>
  );
}

/* ═════════════════ AVISO LEGAL ═════════════════ */
function AvisoLegal() {
  const filas = [
    ['Nombre comercial',    EMPRESA.nombreComercial],
    ['Marca',               EMPRESA.marca],
    ['Razón social / titular', EMPRESA.razonSocial],
    ['RIF',                 EMPRESA.rif],
    ['Registro',            EMPRESA.registro],
    ['Domicilio',           EMPRESA.domicilio],
    ['Correo electrónico',  EMPRESA.correo],
    ['WhatsApp',            EMPRESA.whatsapp],
    ['Sitio web',           EMPRESA.sitioWeb],
  ].filter(([, v]) => v);

  return (
    <>
      <S n="1" t="Datos de identificación del titular">
        <div style={{ background: '#f8fdfd', border: `1px solid ${TURQ}33`, borderRadius: 14, overflow: 'hidden', marginBottom: 10 }}>
          {filas.map(([k, v], i) => (
            <div key={k} style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 16px', padding: '11px 16px', borderTop: i ? `1px solid ${TURQ}1f` : 'none' }}>
              <div style={{ flex: '0 0 190px', fontSize: '.72rem', color: TURQ_DK, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', paddingTop: 2 }}>{k}</div>
              <div style={{ flex: '1 1 200px', fontSize: '.92rem', color: DARK, fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>
      </S>

      <S n="2" t="Objeto del sitio">
        <P>
          Este sitio web tiene por objeto informar sobre las rifas organizadas por {EMPRESA.nombreComercial} bajo la
          marca {EMPRESA.marca} y permitir la reserva y compra de números. La participación se rige por los{' '}
          <Link to="/terminos" style={{ color: TURQ_DK, fontWeight: 600 }}>Términos y Condiciones</Link>.
        </P>
      </S>

      <S n="3" t="Condiciones de acceso">
        <P>
          El acceso a la información del sitio es libre y gratuito. La compra de números está reservada a mayores de 18
          años. El usuario se compromete a hacer un uso lícito del sitio, conforme a la ley, la moral y el orden público.
        </P>
      </S>

      <S n="4" t="Propiedad intelectual e industrial">
        <P>
          Todos los contenidos del sitio (marcas, logotipos, textos, imágenes, diseños de tickets y software) son
          propiedad del titular o de terceros que autorizaron su uso, y están protegidos por la Ley sobre el Derecho de
          Autor y la Ley de Propiedad Industrial de Venezuela. Se prohíbe su reproducción total o parcial sin autorización.
        </P>
      </S>

      <S n="5" t="Responsabilidad">
        <P>
          El titular no se hace responsable de interrupciones del servicio por causas técnicas ajenas a su control, ni
          de los contenidos de sitios de terceros a los que se pueda acceder mediante enlaces. Las cuentas oficiales para
          pagos son exclusivamente las publicadas en este sitio.
        </P>
      </S>

      <S n="6" t="Protección de datos">
        <P>
          Los datos personales se tratan conforme a la{' '}
          <Link to="/privacidad" style={{ color: TURQ_DK, fontWeight: 600 }}>Política de Privacidad</Link>.
        </P>
      </S>

      <S n="7" t="Legislación aplicable">
        <P>
          Este aviso se rige por las leyes de la República Bolivariana de Venezuela, y cualquier controversia se someterá
          a los tribunales competentes de {EMPRESA.jurisdiccion}.
        </P>
      </S>
    </>
  );
}

const CONTENIDO = {
  '/terminos':    Terminos,
  '/privacidad':  Privacidad,
  '/aviso-legal': AvisoLegal,
};

export default function Legal() {
  const { pathname } = useLocation();
  const actual  = DOCS.find(d => d.path === pathname) || DOCS[0];
  const Cuerpo  = CONTENIDO[actual.path];

  useEffect(() => {
    if (!document.getElementById('legal-font')) {
      const l = document.createElement('link');
      l.id = 'legal-font'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap';
      document.head.appendChild(l);
    }
  }, []);

  useEffect(() => {
    document.title = `${actual.label} · ${EMPRESA.nombreComercial}`;
    window.scrollTo(0, 0);
  }, [actual]);

  return (
    <div style={{ minHeight: '100vh', background: '#f0fafa', fontFamily: "'Poppins',sans-serif", color: DARK }}>
      <nav style={{ background: 'rgba(255,255,255,.95)', borderBottom: '1px solid #e0f0f0', padding: '0 5vw', position: 'sticky', top: 0, zIndex: 100, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 36, height: 36, background: `linear-gradient(135deg,${TURQ},${TURQ2})`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>🎰</div>
          <span style={{ fontSize: '1.15rem', color: DARK, fontWeight: 700 }}>{EMPRESA.marca}</span>
        </Link>
        <Link to="/" style={{ fontSize: '.85rem', color: TURQ_DK, fontWeight: 600, textDecoration: 'none' }}>← Volver a las rifas</Link>
      </nav>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '36px 16px 60px' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          {DOCS.map(d => {
            const activo = d.path === actual.path;
            return (
              <Link key={d.path} to={d.path} style={{
                padding: '8px 16px', borderRadius: 50, fontSize: '.8rem', fontWeight: 600, textDecoration: 'none',
                background: activo ? `linear-gradient(135deg,${TURQ},${TURQ2})` : '#fff',
                color: activo ? '#fff' : TURQ_DK,
                border: `1.5px solid ${activo ? 'transparent' : `${TURQ}55`}`,
              }}>{d.label}</Link>
            );
          })}
        </div>

        <article style={{ background: '#fff', borderRadius: 24, padding: 'clamp(22px,4vw,40px)', boxShadow: '0 4px 32px rgba(10,100,100,.08)' }}>
          <div style={{ fontSize: '.62rem', color: TURQ, letterSpacing: '1px', marginBottom: 8, fontWeight: 600 }}>
            {EMPRESA.nombreComercial.toUpperCase()} · {EMPRESA.marca.toUpperCase()}
          </div>
          <h1 style={{ fontSize: 'clamp(1.6rem,3.5vw,2.2rem)', color: DARK, fontWeight: 800, margin: '0 0 6px' }}>{actual.label}</h1>
          <div style={{ fontSize: '.78rem', color: `${DARK}77`, marginBottom: 28 }}>Última actualización: {EMPRESA.actualizado}</div>
          <Cuerpo />
        </article>
      </main>

      <footer style={{ background: DARK, padding: '22px 5vw', textAlign: 'center' }}>
        <span style={{ fontSize: '.6rem', color: 'rgba(255,255,255,.35)', letterSpacing: '0.5px' }}>
          © 2026 {EMPRESA.nombreComercial.toUpperCase()} · {EMPRESA.marca.toUpperCase()} · TODOS LOS DERECHOS RESERVADOS
        </span>
      </footer>
    </div>
  );
}
