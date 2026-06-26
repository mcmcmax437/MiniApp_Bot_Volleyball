import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useApi } from '../api';
import { Icon } from '../Icon';
import './Venues.css';

export function VenuesPage() {
  const api = useApi();
  const qc = useQueryClient();
  const cityQ = useQuery(['default-city'], () => api.defaultCity());
  const venuesQ = useQuery(['venues', cityQ.data?.city], () =>
    api.listVenues({ city: cityQ.data?.city ?? undefined }),
  );

  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <div className="detailMap">
        <Icon name="maps" size={28} className="icon-inline" />
        <span>Map of venues in {cityQ.data?.city}</span>
      </div>

      {venuesQ.isLoading && <div className="empty">Loading venues…</div>}
      {venuesQ.data?.map((v) => (
        <div className="venueCard" key={v.id}>
          <h3>{v.name}</h3>
          <div className="venueRow">
            <span>
              <Icon name="map-pin" className="icon-inline" />
              {v.address}
            </span>
          </div>
          <div className="venueRow">
            <span>
              <span className="tag">{v.indoor ? 'Indoor' : 'Outdoor'}</span>
              {v.surface && <span className="tag">{v.surface}</span>}
            </span>
            <strong>{(v.hourlyPrice / 100).toFixed(2)} / hr</strong>
          </div>
          <div className="venueRow">
            <span>
              <Icon name="user-group" className="icon-inline" />
              Up to {v.capacity} players
            </span>
          </div>
        </div>
      ))}

      <button className="btn secondary" onClick={() => setShowForm((s) => !s)} style={{ marginTop: 12 }}>
        <Icon name={showForm ? 'cancel-01' : 'plus-sign'} size={18} />
        {showForm ? 'Cancel' : 'Suggest a venue'}
      </button>

      {showForm && <SuggestVenueForm onDone={() => { setShowForm(false); qc.invalidateQueries(['venues']); }} />}
    </>
  );
}

function SuggestVenueForm({ onDone }: { onDone: () => void }) {
  const api = useApi();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [indoor, setIndoor] = useState(false);
  const [surface, setSurface] = useState('');
  const [hourlyPrice, setHourlyPrice] = useState(0);
  const [capacity, setCapacity] = useState(10);

  const mut = useMutation(
    () =>
      api.createVenue({
        name,
        address,
        lat,
        lng,
        indoor,
        surface: surface || undefined,
        hourlyPrice,
        capacity,
      }),
    { onSuccess: onDone },
  );

  return (
    <div className="venueCard" style={{ marginTop: 10 }}>
      <h3>Suggest a venue</h3>
      <div className="field">
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Address</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div className="field">
        <label>Lat / Lng</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="number"
            step="0.0001"
            value={lat}
            onChange={(e) => setLat(Number(e.target.value))}
          />
          <input
            type="number"
            step="0.0001"
            value={lng}
            onChange={(e) => setLng(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="field">
        <label>Indoor?</label>
        <select value={indoor ? '1' : '0'} onChange={(e) => setIndoor(e.target.value === '1')}>
          <option value="0">No (outdoor)</option>
          <option value="1">Yes</option>
        </select>
      </div>
      <div className="field">
        <label>Surface (optional)</label>
        <input value={surface} onChange={(e) => setSurface(e.target.value)} placeholder="Sand / Parquet" />
      </div>
      <div className="field">
        <label>Hourly price (minor units)</label>
        <input
          type="number"
          min={0}
          value={hourlyPrice}
          onChange={(e) => setHourlyPrice(Number(e.target.value) || 0)}
        />
      </div>
      <div className="field">
        <label>Capacity</label>
        <input
          type="number"
          min={2}
          max={40}
          value={capacity}
          onChange={(e) => setCapacity(Number(e.target.value) || 10)}
        />
      </div>
      <button
        className="btn"
        disabled={!name || !address || mut.isLoading}
        onClick={() => mut.mutate()}
      >
        <Icon name="send-01" size={18} />
        Submit
      </button>
      {mut.isError && <div className="error">{(mut.error as Error).message}</div>}
    </div>
  );
}
