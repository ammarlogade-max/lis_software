import { FormEvent, useEffect, useState } from 'react';
import { analyzersDb, testGroupsDb } from '../lib/db';
import {
  Cpu,
  Terminal,
  Play,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Radio,
  ArrowDownLeft,
  ArrowUpRight,
  Database,
  Plus,
} from 'lucide-react';

type Analyzer = {
  id: string;
  name: string;
  serial_port: string;
  baud_rate: number;
  connection_type?: 'serial' | 'tcp';
  interface_type?: 'serial' | 'tcp';
  tcp_host?: string | null;
  tcp_port?: number | null;
  protocol?: 'ASTM' | 'HL7';
  barcode_symbology?: string;
  check_digit_enabled?: boolean;
  ignore_flag_enabled?: boolean;
  is_active: boolean;
};
type TestGroup = { id: string; display_name: string; parameters: { id: string; name: string }[] };
type Mapping = { id: string; analyzer_id: string; external_test_code: string; parameter_id: string };

interface SerialLog {
  id: string;
  timestamp: string;
  analyzer: string;
  direction: 'RX' | 'TX';
  raw_packet: string;
  parsed_specimen: string;
  tests_found: string;
}

interface ConnectedPort {
  port: string;
  analyzer: string;
  baud: number;
  status: string;
  parity: string;
  data_bits: number;
  stop_bits: number;
}

export default function Analyzers() {
  const [activeTab, setActiveTab] = useState<'stream' | 'config' | 'mapping'>('stream');
  const [analyzers, setAnalyzers] = useState<Analyzer[]>([]);
  const [groups, setGroups] = useState<TestGroup[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [connectedPorts, setConnectedPorts] = useState<ConnectedPort[]>([]);
  const [logs, setLogs] = useState<SerialLog[]>([]);

  const [name, setName] = useState('');
  const [port, setPort] = useState('COM1');
  const [baud, setBaud] = useState('9600');
  const [interfaceType, setInterfaceType] = useState<'serial' | 'tcp'>('serial');
  const [tcpHost, setTcpHost] = useState('');
  const [tcpPort, setTcpPort] = useState('4148');
  const [protocol, setProtocol] = useState<'ASTM' | 'HL7'>('ASTM');
  const [barcodeSymbology, setBarcodeSymbology] = useState('Code 128');
  const [checkDigit, setCheckDigit] = useState(false);
  const [ignoreFlag, setIgnoreFlag] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const [mapAnalyzer, setMapAnalyzer] = useState('');
  const [mapCode, setMapCode] = useState('');
  const [mapParam, setMapParam] = useState('');

  // Simulation state
  const [simSpecimen, setSimSpecimen] = useState('SPEC-1001');
  const [simulating, setSimulating] = useState(false);
  const [simResultMsg, setSimResultMsg] = useState<string | null>(null);

  async function load() {
    try {
      const [anaList, grpList, mapList, logList] = await Promise.all([
        analyzersDb.list(),
        testGroupsDb.listAll(),
        analyzersDb.mappings(),
        analyzersDb.logs(),
      ]);
      setAnalyzers(anaList || []);
      setGroups(grpList as unknown as TestGroup[]);
      setMappings(mapList || []);
      setConnectedPorts((anaList || []).map((item: any) => ({
        port: item.interface_type === 'tcp' || item.connection_type === 'tcp'
          ? `${item.tcp_host || 'Not configured'}:${item.tcp_port || ''}`
          : item.serial_port || 'Not configured',
        analyzer: item.name,
        baud: item.baud_rate,
        status: item.is_active ? 'Configured' : 'Inactive',
        parity: 'None',
        data_bits: 8,
        stop_bits: 1,
      })));
      setLogs((logList || []).map((item: any) => ({ ...item, analyzer: item.analyzer?.name || '', timestamp: item.created_at })));
    } catch (error) {
      console.error('Unable to load analyzer data', error);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  async function addAnalyzer(e: FormEvent) {
    e.preventDefault();
    setConfigError(null);
    if (interfaceType === 'tcp' && (!tcpHost.trim() || !Number(tcpPort))) {
      setConfigError('TCP analyzers require a host and valid port.');
      return;
    }
    await analyzersDb.create({
      name,
      serial_port: interfaceType === 'serial' ? port.trim() : null,
      baud_rate: Number(baud),
      connection_type: interfaceType,
      interface_type: interfaceType,
      tcp_host: interfaceType === 'tcp' ? tcpHost.trim() : null,
      tcp_port: interfaceType === 'tcp' ? Number(tcpPort) : null,
      protocol,
      barcode_symbology: barcodeSymbology,
      check_digit_enabled: checkDigit,
      ignore_flag_enabled: ignoreFlag,
      is_active: true,
    });
    setName('');
    setPort('COM1');
    setBaud('9600');
    setInterfaceType('serial');
    setTcpHost('');
    setTcpPort('4148');
    setProtocol('ASTM');
    setBarcodeSymbology('Code 128');
    setCheckDigit(false);
    setIgnoreFlag(false);
    await load();
  }

  async function addMapping(e: FormEvent) {
    e.preventDefault();
    if (!mapAnalyzer || !mapCode || !mapParam) return;
    await analyzersDb.createMapping({
      analyzer_id: mapAnalyzer,
      external_test_code: mapCode,
      parameter_id: mapParam,
    });
    setMapCode('');
    setMapParam('');
    await load();
  }

  async function handleSimulateFeed() {
    try {
      setSimulating(true);
      setSimResultMsg(null);
      setSimResultMsg(`No synthetic feed was sent. Configure a real analyzer connector for specimen ${simSpecimen}.`);
    } catch (e: any) {
      setSimResultMsg(`Failed to simulate: ${e.message}`);
    } finally {
      setSimulating(false);
    }
  }

  const allParams = groups.flatMap((g) => g.parameters.map((p) => ({ ...p, groupName: g.display_name })));

  return (
    <div id="analyzers-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="p-2.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
            <Cpu className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Bidirectional Analyzer Interfacing</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              ASTM E1381/E1394 & HL7 serial port listeners, automated specimen barcode matching, and direct instrument results ingestion
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Ports
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('stream')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'stream'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          Live ASTM / HL7 Serial Stream
        </button>

        <button
          onClick={() => setActiveTab('mapping')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'mapping'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          Test Code → Parameter Mappings ({mappings.length})
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'config'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Port & Hardware Configurations ({analyzers.length})
        </button>
      </div>

      {/* Tab 1: Live Serial Stream & Simulator */}
      {activeTab === 'stream' && (
        <div className="space-y-6">
          {/* Active Ports Strip */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {connectedPorts.map((p, idx) => (
              <div key={idx} className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center font-mono font-bold text-xs">
                    {p.port}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-white">{p.analyzer}</h4>
                    <div className="text-[11px] text-slate-400">
                      Baud: <span className="text-slate-200 font-mono">{p.baud}</span> | Bits: {p.data_bits} | Parity: {p.parity}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Instrument Simulator Box */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                  ASTM Analyzer Broadcast Simulator
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">Injects synthetic RS-232 ASTM packets to test live parsing</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex-1 w-full">
                <input
                  type="text"
                  value={simSpecimen}
                  onChange={(e) => setSimSpecimen(e.target.value)}
                  placeholder="Target Specimen Barcode (e.g. SPEC-1001 or SPEC-1002)"
                  className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <button
                type="button"
                disabled={simulating}
                onClick={handleSimulateFeed}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition"
              >
                <Play className="w-3.5 h-3.5" />
                {simulating ? 'Emulating RX...' : 'Simulate Analyzer RX Transmission'}
              </button>
            </div>

            {simResultMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{simResultMsg}</span>
              </div>
            )}
          </div>

          {/* Terminal Logs Viewer */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 shadow-xl overflow-hidden">
            <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                </div>
                <span className="font-mono font-bold text-slate-200 ml-2">RS-232 Serial Port Packet Monitor</span>
              </div>
              <span className="font-mono text-[10px] text-slate-400">ASTM E1381 / E1394 Frame Parser Active</span>
            </div>

            <div className="p-4 font-mono text-xs space-y-3 max-h-96 overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="p-2.5 rounded bg-slate-900/60 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">[{log.timestamp}]</span>
                      <span className="font-bold text-blue-400">{log.analyzer}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          log.direction === 'RX' ? 'bg-emerald-950 text-emerald-300' : 'bg-sky-950 text-sky-300'
                        }`}
                      >
                        {log.direction}
                      </span>
                    </div>
                    <span className="text-amber-400 font-bold">Barcoded: {log.parsed_specimen}</span>
                  </div>

                  <div className="text-slate-300 bg-slate-950 p-2 rounded border border-slate-800 overflow-x-auto text-[11px] text-emerald-400">
                    {log.raw_packet}
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <span className="text-slate-500">Parsed Test Values:</span>
                    <span className="text-slate-200 font-semibold">{log.tests_found}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Parameter Mappings */}
      {activeTab === 'mapping' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h2 className="font-bold text-sm text-slate-900">Map Instrument Code → LIS Parameter</h2>
            <form onSubmit={addMapping} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Target Analyzer *</label>
                <select
                  required
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                  value={mapAnalyzer}
                  onChange={(e) => setMapAnalyzer(e.target.value)}
                >
                  <option value="">Select analyzer...</option>
                  {analyzers.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.serial_port})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Instrument Output Code *</label>
                <input
                  placeholder="e.g. HGB, WBC, PLT, GLU, CREA"
                  required
                  className="w-full text-xs font-mono font-bold uppercase border border-slate-300 rounded-lg px-3 py-2"
                  value={mapCode}
                  onChange={(e) => setMapCode(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Maps to LIS Parameter *</label>
                <select
                  required
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                  value={mapParam}
                  onChange={(e) => setMapParam(e.target.value)}
                >
                  <option value="">Select LIS parameter...</option>
                  {allParams.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.groupName} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-xs font-bold shadow-xs transition"
              >
                Save Code Mapping
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-xs text-slate-900">Configured External Test Mappings</h3>
              <span className="text-[11px] text-slate-500">{mappings.length} Active Mappings</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Instrument Code</th>
                    <th className="py-2.5 px-4">LIS Parameter Target</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mappings.map((m) => {
                    const param = allParams.find((p) => p.id === m.parameter_id);
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-mono font-bold text-blue-700 text-xs">
                          {m.external_test_code}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-800">
                          {param ? `${param.groupName} — ${param.name}` : m.parameter_id}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {mappings.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-400" colSpan={3}>
                        No code mappings configured yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Hardware & Ports Config */}
      {activeTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h2 className="font-bold text-sm text-slate-900">Register New Lab Instrument</h2>
            <form onSubmit={addAnalyzer} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Instrument Model & Brand *</label>
                <input
                  placeholder="e.g. HORIBA ABX Micros ES60"
                  required
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Interface *</label>
                  <select
                    value={interfaceType}
                    onChange={(e) => setInterfaceType(e.target.value as 'serial' | 'tcp')}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="serial">Serial / COM</option>
                    <option value="tcp">TCP/IP</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">{interfaceType === 'tcp' ? 'TCP Host' : 'Serial Port *'}</label>
                  <input
                    placeholder={interfaceType === 'tcp' ? '192.168.1.20' : 'COM1'}
                    required={interfaceType === 'serial'}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg px-3 py-2"
                    value={interfaceType === 'tcp' ? tcpHost : port}
                    onChange={(e) => (interfaceType === 'tcp' ? setTcpHost(e.target.value) : setPort(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Baud Rate *</label>
                  <select
                    value={baud}
                    onChange={(e) => setBaud(e.target.value)}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="4800">4800 bps</option>
                    <option value="9600">9600 bps</option>
                    <option value="19200">19200 bps</option>
                    <option value="38400">38400 bps</option>
                    <option value="115200">115200 bps</option>
                  </select>
                </div>
              </div>

              {interfaceType === 'tcp' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">TCP Port *</label>
                  <input
                    type="number"
                    min="1"
                    max="65535"
                    value={tcpPort}
                    onChange={(e) => setTcpPort(e.target.value)}
                    className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Protocol</label>
                  <select value={protocol} onChange={(e) => setProtocol(e.target.value as 'ASTM' | 'HL7')} className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white">
                    <option>ASTM</option>
                    <option>HL7</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Barcode Symbology</label>
                  <select value={barcodeSymbology} onChange={(e) => setBarcodeSymbology(e.target.value)} className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white">
                    <option>Interleaved 2 of 5</option>
                    <option>Code 39</option>
                    <option>Code 128</option>
                    <option>Codabar</option>
                    <option>ISBT 128</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4 text-xs">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={checkDigit} onChange={(e) => setCheckDigit(e.target.checked)} />
                  Check digit
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={ignoreFlag} onChange={(e) => setIgnoreFlag(e.target.checked)} />
                  Ignore flag
                </label>
              </div>

              {configError && <p className="text-xs text-rose-600">{configError}</p>}

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-xs font-bold shadow-xs transition"
              >
                Register Instrument
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-xs text-slate-900">Configured Analyzers Registry</h3>
              <span className="text-[11px] text-slate-500">{analyzers.length} Registered</span>
            </div>

            <div className="divide-y divide-slate-100">
              {analyzers.map((a) => (
                <div key={a.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50">
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">{a.name}</h4>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Port: <span className="font-mono font-bold text-slate-700">{a.serial_port}</span> | Speed:{' '}
                      <span className="font-mono">{a.baud_rate} baud</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" />
                    Listening
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
