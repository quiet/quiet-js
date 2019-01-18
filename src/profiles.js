export default {
    'audible': {
        'checksum_scheme': 'crc32',
        'encoder_filters': {
            'dc_filter_alpha': 0.01
        },
        'frame_length': 100,
        'inner_fec_scheme': 'v27',
        'interpolation': {
            'excess_bandwidth': 0.35,
            'samples_per_symbol': 10,
            'shape': 'kaiser',
            'symbol_delay': 4
        },
        'mod_scheme': 'gmsk',
        'modulation': {
            'center_frequency': 4200,
            'gain': 0.1
        },
        'outer_fec_scheme': 'none',
        'resampler': {
            'attenuation': 60,
            'bandwidth': 0.45,
            'delay': 13,
            'filter_bank_size': 64
        }
    },
    'audible-7k-channel-0': {
        'checksum_scheme': 'crc32',
        'encoder_filters': {
            'dc_filter_alpha': 0.01
        },
        'frame_length': 600,
        'inner_fec_scheme': 'rs8',
        'interpolation': {
            'excess_bandwidth': 0.31,
            'samples_per_symbol': 6,
            'shape': 'kaiser',
            'symbol_delay': 4
        },
        'mod_scheme': 'arb16opt',
        'modulation': {
            'center_frequency': 9200,
            'gain': 0.1
        },
        'ofdm': {
            'cyclic_prefix_length': 8,
            'left_band': 0,
            'num_subcarriers': 48,
            'right_band': 0,
            'taper_length': 4
        },
        'outer_fec_scheme': 'v29',
        'resampler': {
            'attenuation': 60,
            'bandwidth': 0.45,
            'delay': 13,
            'filter_bank_size': 64
        }
    },
    'audible-7k-channel-1': {
        'checksum_scheme': 'crc32',
        'encoder_filters': {
            'dc_filter_alpha': 0.01
        },
        'frame_length': 600,
        'inner_fec_scheme': 'rs8',
        'interpolation': {
            'excess_bandwidth': 0.31,
            'samples_per_symbol': 6,
            'shape': 'kaiser',
            'symbol_delay': 4
        },
        'mod_scheme': 'arb16opt',
        'modulation': {
            'center_frequency': 15500,
            'gain': 0.1
        },
        'ofdm': {
            'cyclic_prefix_length': 8,
            'left_band': 0,
            'num_subcarriers': 48,
            'right_band': 0,
            'taper_length': 4
        },
        'outer_fec_scheme': 'v29',
        'resampler': {
            'attenuation': 60,
            'bandwidth': 0.45,
            'delay': 13,
            'filter_bank_size': 64
        }
    },
    'cable-64k': {
        'checksum_scheme': 'crc32',
        'encoder_filters': {
            'dc_filter_alpha': 0.03
        },
        'frame_length': 7500,
        'inner_fec_scheme': 'v27p23',
        'interpolation': {
            'excess_bandwidth': 0.35,
            'samples_per_symbol': 2,
            'shape': 'kaiser',
            'symbol_delay': 4
        },
        'mod_scheme': 'qam1024',
        'modulation': {
            'center_frequency': 10200,
            'gain': 0.09
        },
        'ofdm': {
            'cyclic_prefix_length': 16,
            'left_band': 6,
            'num_subcarriers': 128,
            'right_band': 12,
            'taper_length': 8
        },
        'outer_fec_scheme': 'rs8',
        'resampler': {
            'attenuation': 60,
            'bandwidth': 0.45,
            'delay': 13,
            'filter_bank_size': 64
        }
    },
    'hello-world': {
        'checksum_scheme': 'crc32',
        'encoder_filters': {
            'dc_filter_alpha': 0.01
        },
        'frame_length': 25,
        'inner_fec_scheme': 'v27',
        'interpolation': {
            'excess_bandwidth': 0.38,
            'samples_per_symbol': 20,
            'shape': 'kaiser',
            'symbol_delay': 4
        },
        'mod_scheme': 'gmsk',
        'modulation': {
            'center_frequency': 4400,
            'gain': 0.08
        },
        'outer_fec_scheme': 'none',
        'resampler': {
            'attenuation': 60,
            'bandwidth': 0.45,
            'delay': 13,
            'filter_bank_size': 64
        }
    },
    'ultrasonic': {
        'checksum_scheme': 'crc32',
        'encoder_filters': {
            'dc_filter_alpha': 0.01
        },
        'frame_length': 75,
        'inner_fec_scheme': 'v27',
        'interpolation': {
            'excess_bandwidth': 0.35,
            'samples_per_symbol': 14,
            'shape': 'rrcos',
            'symbol_delay': 4
        },
        'mod_scheme': 'gmsk',
        'modulation': {
            'center_frequency': 19000,
            'gain': 0.1
        },
        'outer_fec_scheme': 'none',
        'resampler': {
            'attenuation': 60,
            'bandwidth': 0.45,
            'delay': 13,
            'filter_bank_size': 64
        }
    },
    'ultrasonic-3600': {
        'checksum_scheme': 'crc8',
        'encoder_filters': {
            'dc_filter_alpha': 0.01
        },
        'frame_length': 550,
        'inner_fec_scheme': 'v27',
        'interpolation': {
            'excess_bandwidth': 0.33,
            'samples_per_symbol': 7,
            'shape': 'kaiser',
            'symbol_delay': 4
        },
        'mod_scheme': 'V29',
        'modulation': {
            'center_frequency': 18500,
            'gain': 0.1
        },
        'ofdm': {
            'cyclic_prefix_length': 20,
            'left_band': 4,
            'num_subcarriers': 64,
            'right_band': 13,
            'taper_length': 8
        },
        'outer_fec_scheme': 'none',
        'resampler': {
            'attenuation': 60,
            'bandwidth': 0.45,
            'delay': 13,
            'filter_bank_size': 64
        }
    },
    'ultrasonic-experimental': {
        'checksum_scheme': 'crc32',
        'encoder_filters': {
            'dc_filter_alpha': 0.01
        },
        'frame_length': 100,
        'header': {
            'checksum_scheme': 'crc32',
            'inner_fec_scheme': 'secded7264',
            'mod_scheme': 'bpsk',
            'outer_fec_scheme': 'v29'
        },
        'inner_fec_scheme': 'rs8',
        'interpolation': {
            'excess_bandwidth': 0.31,
            'samples_per_symbol': 10,
            'shape': 'kaiser',
            'symbol_delay': 4
        },
        'mod_scheme': 'bpsk',
        'modulation': {
            'center_frequency': 19000,
            'gain': 0.2
        },
        'outer_fec_scheme': 'v29',
        'resampler': {
            'attenuation': 60,
            'bandwidth': 0.45,
            'delay': 13,
            'filter_bank_size': 64
        }
    },
    'ultrasonic-whisper': {
        'checksum_scheme': 'crc32',
        'encoder_filters': {
            'dc_filter_alpha': 0.01
        },
        'frame_length': 16,
        'inner_fec_scheme': 'v27',
        'interpolation': {
            'excess_bandwidth': 0.35,
            'samples_per_symbol': 30,
            'shape': 'rrcos',
            'symbol_delay': 4
        },
        'mod_scheme': 'gmsk',
        'modulation': {
            'center_frequency': 19500,
            'gain': 0.1
        },
        'outer_fec_scheme': 'none',
        'resampler': {
            'attenuation': 60,
            'bandwidth': 0.45,
            'delay': 13,
            'filter_bank_size': 64
        }
    }
};
